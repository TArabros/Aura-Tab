import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, AIPanelMode, Shortcut, ShortcutFolder } from '@/types';
import { getSettings, saveSettings, getShortcuts, getBackgroundImage, getFolders, DEFAULT_SETTINGS } from '@/services/storage';
import Clock from '@/components/Clock';
import SearchBar from '@/components/SearchBar';
import ShortcutGrid from '@/components/shortcuts/ShortcutGrid';
import MediaWidget from '@/components/media/MediaWidget';
import AIPanel from '@/components/ai/AIPanel';
import SettingsModal from '@/components/settings/SettingsModal';
import { Settings, Sparkles, Sun, Moon } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [folders, setFolders] = useState<ShortcutFolder[]>([]);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AIPanelMode>('hidden');
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function load() {
      try {
        const [s, sc, f, bg] = await Promise.all([
          getSettings(),
          getShortcuts(),
          getFolders(),
          getBackgroundImage(),
        ]);

        // Detect system theme on first ever load
        let resolvedSettings = s;
        if (!s._themeInitialized) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          resolvedSettings = {
            ...s,
            theme: prefersDark ? 'dark' : 'light',
            _themeInitialized: true,
          };
          await saveSettings(resolvedSettings);
        }

        setSettings(resolvedSettings);
        setShortcuts(sc);
        setFolders(f);
        setCustomBg(bg);
        setAiMode(resolvedSettings.aiPanelMode || 'hidden');
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
      setLoaded(true);
    }
    load();
  }, []);

  // Apply theme class to body and html for consistent styling
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
      document.body.style.background = '#f1f5f9';
      document.body.style.color = '#0f172a';
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      document.body.style.background = '#0a0a14';
      document.body.style.color = 'rgba(255, 255, 255, 0.95)';
    }
  }, [settings.theme]);

  // Handle Escape key to close AI panel and settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else if (aiMode !== 'hidden') {
          handleAiModeChange('hidden');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiMode, showSettings]);

  const handleSettingsChange = useCallback(async (newSettings: AppSettings) => {
    // Add smooth theme transition
    if (newSettings.theme !== settings.theme) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 450);
    }
    setSettings(newSettings);
    await saveSettings(newSettings);
  }, [settings.theme]);

  const handleAiModeChange = useCallback((mode: AIPanelMode) => {
    setAiMode(mode);
    setSettings(prev => {
      const updated = { ...prev, aiPanelMode: mode };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleSettingsChange({ ...settings, theme: newTheme });
  }, [settings, handleSettingsChange]);

  // Build background style
  const bgStyle = buildBackgroundStyle(settings, customBg);

  // Determine grid margin for AI panel
  const mainMarginRight = aiMode === 'compact' ? 340 : aiMode === 'expanded' ? 520 : 0;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#0a0a14]">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const themeClass = settings.theme === 'light' ? 'theme-light' : '';
  const glassAlpha = settings.background.glassOpacity;
  const glassHoverAlpha = Math.min(1, glassAlpha + 0.06);

  const containerStyle: React.CSSProperties = {
    ['--color-glass' as string]: settings.theme === 'light'
      ? '#ffffff'
      : `rgba(255, 255, 255, ${glassAlpha})`,
    ['--color-glass-hover' as string]: settings.theme === 'light'
      ? '#ffffff'
      : `rgba(255, 255, 255, ${glassHoverAlpha})`,
  };

  const gridPositionClass =
    settings.grid.position === 'top'
      ? 'justify-start pt-2'
      : settings.grid.position === 'bottom'
      ? 'justify-end pb-8'
      : 'justify-center -mt-16';

  return (
    <div className={`relative w-full h-full overflow-hidden ${themeClass}`} style={containerStyle}>
      {/* Background */}
      <div className="absolute inset-0 z-0 transition-all duration-500 ease-out" style={bgStyle} />
      <div
        className="absolute inset-0 z-[1] transition-colors duration-500 pointer-events-none"
        style={{
          background: settings.theme === 'light'
            ? 'transparent'
            : `rgba(0,0,0,${settings.background.darkness})`,
        }}
      />

      {/* Main Content */}
      <div
        className="relative z-10 flex flex-col items-center h-full overflow-y-auto px-6 py-8 transition-all duration-500 ease-out"
        style={{ marginRight: mainMarginRight }}
      >
        {/* Top Bar */}
        <div className="w-full flex justify-between items-center mb-4 animate-fade-in">
          <MediaWidget />
          <div className="flex items-center gap-2">
            {/* Theme Switcher Pill */}
            <div
              className="theme-switcher-pill flex items-center p-0.5 rounded-full cursor-pointer transition-all"
              onClick={toggleTheme}
              title={settings.theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  settings.theme === 'light' ? 'theme-pill-active' : 'opacity-40 hover:opacity-80'
                }`}
                onClick={(e) => { e.stopPropagation(); if (settings.theme !== 'light') toggleTheme(); }}
              >
                <Sun size={14} className={settings.theme === 'light' ? 'text-amber-500' : ''} />
                <span>Светлая</span>
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  settings.theme === 'dark' ? 'theme-pill-active' : 'opacity-40 hover:opacity-80'
                }`}
                onClick={(e) => { e.stopPropagation(); if (settings.theme !== 'dark') toggleTheme(); }}
              >
                <Moon size={14} className={settings.theme === 'dark' ? 'text-indigo-400' : ''} />
                <span>Тёмная</span>
              </button>
            </div>
            {/* Settings */}
            <button
              className="nova-btn-icon"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings size={20} />
            </button>
            {/* AI Toggle */}
            <button
              className={`nova-btn-icon ${aiMode !== 'hidden' ? 'ai-active' : ''}`}
              onClick={() => handleAiModeChange(aiMode === 'hidden' ? 'compact' : 'hidden')}
              title="AI Assistant"
            >
              <Sparkles size={20} />
            </button>
          </div>
        </div>

        {/* Center Content */}
        <div className={`flex-1 flex flex-col items-center w-full max-w-4xl transition-all duration-300 ${gridPositionClass}`}>
          <Clock userName={settings.userName} />

          {/* Search section with visual separation */}
          <div className="w-full flex justify-center">
            <SearchBar />
          </div>

          {/* Shortcuts grid section (positioned lower from search bar) */}
          <div className="w-full" style={{ marginTop: '70px' }}>
            <ShortcutGrid
              shortcuts={shortcuts}
              folders={folders}
              onShortcutsChange={setShortcuts}
              onFoldersChange={setFolders}
              gridSettings={settings.grid}
            />
          </div>
        </div>
      </div>

      {/* Floating launcher when AI panel is hidden */}
      {aiMode === 'hidden' && (
        <button
          onClick={() => handleAiModeChange('compact')}
          className="ai-launcher"
          title="Open AI Assistant"
        >
          <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
          <span className="ai-launcher-text">AI</span>
        </button>
      )}

      {/* AI Panel — always mounted, visibility controlled by CSS */}
      <AIPanel
        mode={aiMode}
        onModeChange={handleAiModeChange}
        settings={settings.ai}
        onSettingsChange={(aiSettings) =>
          handleSettingsChange({ ...settings, ai: aiSettings })
        }
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
          onBgChange={setCustomBg}
          onOpenAi={() => {
            setShowSettings(false);
            handleAiModeChange('compact');
          }}
        />
      )}
    </div>
  );
}

function buildBackgroundStyle(
  settings: AppSettings,
  customBg: string | null,
): React.CSSProperties {
  const bg = settings.background;
  const isLight = settings.theme === 'light';
  const filter = bg.blur > 0 ? `blur(${bg.blur}px)` : undefined;

  if (bg.type === 'custom' && customBg) {
    return {
      backgroundImage: `url(${customBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter,
      transform: filter ? 'scale(1.1)' : undefined,
    };
  }

  if (bg.type === 'preset' && bg.presetId) {
    const preset = PRESET_BACKGROUNDS.find(p => p.id === bg.presetId);
    if (preset) {
      return {
        backgroundImage: `url(${preset.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter,
        transform: filter ? 'scale(1.1)' : undefined,
      };
    }
  }

  if (bg.type === 'solid' && bg.solidColor) {
    if (isLight && (bg.solidColor === '#0a0a14' || bg.solidColor === '#000000')) {
      return { background: '#f5f7fb' };
    }
    return { background: bg.solidColor };
  }

  // Light theme background
  if (isLight) {
    return {
      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #edf2f7 100%)',
    };
  }

  // Default dark gradient
  const start = bg.gradientStart || '#0f0c29';
  const end = bg.gradientEnd || '#302b63';
  const angle = bg.gradientAngle ?? 135;
  return {
    background: `linear-gradient(${angle}deg, ${start}, ${end})`,
  };
}

export const PRESET_BACKGROUNDS = [
  { id: 'dark-minimal-1', name: 'Dark Void', category: 'Dark Minimal', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&q=80', thumbnail: '' },
  { id: 'dark-minimal-2', name: 'Monochrome Geometry', category: 'Dark Minimal', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80', thumbnail: '' },
  { id: 'cyberpunk-1', name: 'Cyber District', category: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80', thumbnail: '' },
  { id: 'cyberpunk-2', name: 'Neon Glitch', category: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&q=80', thumbnail: '' },
  { id: 'neon-city-1', name: 'Tokyo After Hours', category: 'Neon City', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80', thumbnail: '' },
  { id: 'neon-city-2', name: 'Rainy Boulevard', category: 'Neon City', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80', thumbnail: '' },
  { id: 'space-1', name: 'Deep Cosmos', category: 'Space', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80', thumbnail: '' },
  { id: 'space-2', name: 'Northern Aurora', category: 'Space', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80', thumbnail: '' },
  { id: 'nature-1', name: 'Misty Alpine', category: 'Nature', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80', thumbnail: '' },
  { id: 'nature-2', name: 'Nordic Forest', category: 'Nature', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', thumbnail: '' },
  { id: 'abstract-1', name: 'Liquid Purple Flow', category: 'Abstract', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80', thumbnail: '' },
  { id: 'abstract-2', name: 'Chromatic Swirl', category: 'Abstract', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&q=80', thumbnail: '' },
  { id: 'anime-1', name: 'Cherry Blossom Sunset', category: 'Anime-inspired', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&q=80', thumbnail: '' },
  { id: 'anime-2', name: 'Twilight Neon Sky', category: 'Anime-inspired', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1920&q=80', thumbnail: '' },
  { id: 'glass-1', name: 'Frosted Prisms', category: 'Glassmorphism', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80', thumbnail: '' },
  { id: 'glass-2', name: 'Iridescent Glass', category: 'Glassmorphism', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1920&q=80', thumbnail: '' },
];
