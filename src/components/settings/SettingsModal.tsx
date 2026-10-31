import { useState, useRef } from 'react';
import type { AppSettings, BackgroundType } from '@/types';
import { PRESET_BACKGROUNDS } from '@/newtab/App';
import { saveBackgroundImage, exportAllData, importAllData, DEFAULT_SETTINGS } from '@/services/storage';
import {
  X, Grid3x3, Image, RotateCcw, Sliders, Upload, Download, User, Sparkles
} from 'lucide-react';

interface Props {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  onBgChange: (bg: string | null) => void;
  onOpenAi?: () => void;
}

type Tab = 'general' | 'background' | 'grid';

export default function SettingsModal({ settings, onSettingsChange, onClose, onBgChange, onOpenAi }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <User size={16} /> },
    { id: 'background', label: 'Background', icon: <Image size={16} /> },
    { id: 'grid', label: 'Grid', icon: <Grid3x3 size={16} /> },
  ];

  const update = (partial: Partial<AppSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  // ===== Background upload =====
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      await saveBackgroundImage(dataUrl);
      onBgChange(dataUrl);
      update({
        background: { ...settings.background, type: 'custom' as BackgroundType },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? Your shortcuts, chats and AI connection will be preserved.')) {
      onSettingsChange({ ...DEFAULT_SETTINGS, ai: settings.ai, _themeInitialized: true });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sliders size={20} className="text-[var(--color-accent)]" />
            Settings
          </h2>
          <button onClick={onClose} className="nova-btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--settings-tab-bg)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all
                ${tab === t.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-secondary)]'
                }`}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: tab === t.id ? undefined : 'transparent' }}
              onMouseEnter={(e) => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = 'var(--settings-tab-hover)'; }}
              onMouseLeave={(e) => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {tab === 'general' && (
            <GeneralTab settings={settings} update={update} onOpenAi={onOpenAi} />
          )}

          {tab === 'background' && (
            <BackgroundTab
              settings={settings}
              update={update}
              onImageUpload={handleImageUpload}
              fileInputRef={fileInputRef}
            />
          )}

          {tab === 'grid' && (
            <GridTab settings={settings} update={update} />
          )}
        </div>

        {/* Footer with Reset to Defaults in bottom-left */}
        <div
          className="flex items-center justify-between pt-3 mt-3 border-t"
          style={{ borderColor: 'var(--divider-color)' }}
        >
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-bg)]"
            style={{ border: '1px solid var(--settings-option-border)', background: 'var(--settings-tab-bg)' }}
            title="Reset to Defaults"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}



// ===== General Tab =====
function GeneralTab({
  settings,
  update,
  onOpenAi,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
  onOpenAi?: () => void;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  const handleExport = async () => {
    const blob = new Blob([await exportAllData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova-tab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!confirm('Replace current settings, shortcuts, folders and chats with this backup?')) return;
    try {
      await importAllData(await file.text());
      window.location.reload();
    } catch (err) {
      setImportError(err instanceof SyntaxError
        ? 'This file is not valid JSON'
        : err instanceof Error ? err.message : 'Failed to restore the backup');
    }
  };

  return (
    <>
      <div>
        <label className="text-sm opacity-60 mb-2 block">Your name</label>
        <input
          type="text"
          value={settings.userName}
          onChange={(e) => update({ userName: e.target.value })}
          placeholder="Shown in the greeting"
          className="nova-input"
          maxLength={40}
        />
      </div>

      {onOpenAi && (
        <button onClick={onOpenAi} className="nova-btn nova-btn-ghost w-full">
          <Sparkles size={16} />
          Open AI Assistant
        </button>
      )}

      <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--divider-color)' }}>
        <label className="text-sm opacity-60 block">Backup</label>
        <div className="flex gap-2">
          <button onClick={handleExport} className="nova-btn nova-btn-ghost flex-1">
            <Download size={16} />
            Export
          </button>
          <button onClick={() => importInputRef.current?.click()} className="nova-btn nova-btn-ghost flex-1">
            <Upload size={16} />
            Import
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
        {importError && <p className="text-[var(--color-error)] text-sm">{importError}</p>}
        <p className="text-[11px] opacity-40">
          Includes settings, shortcuts, folders and chats. Your API key and uploaded wallpaper are not included.
        </p>
      </div>
    </>
  );
}

// ===== Background Tab =====
function BackgroundTab({
  settings,
  update,
  onImageUpload,
  fileInputRef,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const bg = settings.background;
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const setType = (type: BackgroundType) => {
    update({ background: { ...bg, type } });
  };

  const GRADIENT_PRESETS = [
    { name: 'Deep Night', start: '#0f0c29', end: '#302b63', angle: 135 },
    { name: 'Sunset Glow', start: '#200122', end: '#6f0000', angle: 120 },
    { name: 'Cyber Neon', start: '#050515', end: '#4a0e4e', angle: 145 },
    { name: 'Emerald Dark', start: '#061a14', end: '#0a3d31', angle: 130 },
    { name: 'Ocean Depth', start: '#021b2b', end: '#083344', angle: 160 },
  ];

  const SOLID_SWATCHES = ['#0a0a14', '#121218', '#0f172a', '#18181b', '#09090b', '#1e1b4b'];

  const categories = [
    'All',
    'Dark Minimal',
    'Cyberpunk',
    'Neon City',
    'Space',
    'Nature',
    'Abstract',
    'Anime-inspired',
    'Glassmorphism',
  ];

  const filteredPresets = selectedCategory === 'All'
    ? PRESET_BACKGROUNDS
    : PRESET_BACKGROUNDS.filter(p => p.category === selectedCategory);

  return (
    <>
      {/* Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {(['gradient', 'preset', 'custom', 'solid'] as BackgroundType[]).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all`}
            style={{
              cursor: 'pointer', fontFamily: 'inherit',
              borderColor: bg.type === t ? 'var(--color-accent)' : 'var(--settings-option-border)',
              background: bg.type === t ? 'var(--settings-selected-bg)' : 'transparent',
              color: bg.type === t ? 'var(--color-accent)' : 'inherit',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Preset Backgrounds with Category Filter */}
      {bg.type === 'preset' && (
        <div className="space-y-3">
          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors border`}
                style={{
                  borderColor: selectedCategory === cat ? 'transparent' : 'var(--settings-option-border)',
                  background: selectedCategory === cat ? 'var(--color-accent)' : 'var(--settings-tab-bg)',
                  color: selectedCategory === cat ? 'white' : 'inherit',
                  opacity: selectedCategory === cat ? 1 : 0.7,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Preset Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
            {filteredPresets.map(preset => (
              <button
                key={preset.id}
                onClick={() => update({ background: { ...bg, presetId: preset.id } })}
                className={`relative overflow-hidden rounded-xl aspect-video border-2 transition-all cursor-pointer group
                  ${bg.presetId === preset.id
                    ? 'border-[var(--color-accent)] shadow-[0_0_15px_var(--color-accent-glow)]'
                    : 'border-transparent hover:border-[rgba(255,255,255,0.2)]'
                  }`}
                style={{ background: 'var(--settings-tab-bg)' }}
              >
                <img
                  src={preset.url}
                  alt={preset.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex justify-between items-center">
                  <span className="text-[10px] font-medium truncate">{preset.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gradient Controls */}
      {bg.type === 'gradient' && (
        <div className="space-y-3">
          {/* Quick Gradient Presets */}
          <div>
            <label className="text-xs opacity-40 block mb-1.5">Quick Presets</label>
            <div className="flex gap-1.5 flex-wrap">
              {GRADIENT_PRESETS.map(gp => (
                <button
                  key={gp.name}
                  onClick={() => update({
                    background: {
                      ...bg,
                      gradientStart: gp.start,
                      gradientEnd: gp.end,
                      gradientAngle: gp.angle,
                    }
                  })}
                  className="px-2.5 py-1 rounded-md text-[11px] border transition-colors"
                  style={{ borderColor: 'var(--settings-option-border)', background: 'var(--settings-tab-bg)' }}
                >
                  {gp.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs opacity-40 block mb-1">Start Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={bg.gradientStart || '#0f0c29'}
                  onChange={(e) => update({ background: { ...bg, gradientStart: e.target.value } })}
                  className="w-8 h-8 rounded-lg border-none cursor-pointer"
                />
                <input
                  type="text"
                  value={bg.gradientStart || '#0f0c29'}
                  onChange={(e) => update({ background: { ...bg, gradientStart: e.target.value } })}
                  className="nova-input text-xs flex-1"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs opacity-40 block mb-1">End Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={bg.gradientEnd || '#302b63'}
                  onChange={(e) => update({ background: { ...bg, gradientEnd: e.target.value } })}
                  className="w-8 h-8 rounded-lg border-none cursor-pointer"
                />
                <input
                  type="text"
                  value={bg.gradientEnd || '#302b63'}
                  onChange={(e) => update({ background: { ...bg, gradientEnd: e.target.value } })}
                  className="nova-input text-xs flex-1"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs opacity-40 block mb-1">Angle: {bg.gradientAngle ?? 135}°</label>
            <input
              type="range"
              min="0"
              max="360"
              value={bg.gradientAngle ?? 135}
              onChange={(e) => update({ background: { ...bg, gradientAngle: parseInt(e.target.value) } })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
        </div>
      )}

      {/* Solid Color */}
      {bg.type === 'solid' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs opacity-40 block mb-1.5">Color Palette</label>
            <div className="flex gap-2 items-center">
              {SOLID_SWATCHES.map(color => (
                <button
                  key={color}
                  onClick={() => update({ background: { ...bg, solidColor: color } })}
                  className="w-7 h-7 rounded-lg border cursor-pointer transition-transform hover:scale-110"
                  style={{ borderColor: 'var(--settings-option-border)', background: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={bg.solidColor || '#0a0a14'}
              onChange={(e) => update({ background: { ...bg, solidColor: e.target.value } })}
              className="w-10 h-10 rounded-lg border-none cursor-pointer"
            />
            <input
              type="text"
              value={bg.solidColor || '#0a0a14'}
              onChange={(e) => update({ background: { ...bg, solidColor: e.target.value } })}
              className="nova-input text-xs flex-1"
            />
          </div>
        </div>
      )}

      {/* Custom Image Upload */}
      {bg.type === 'custom' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="nova-btn nova-btn-ghost w-full"
          >
            <Upload size={16} />
            Upload Image from Computer
          </button>
          <p className="text-[11px] opacity-40 text-center">
            Images are stored locally via IndexedDB and persist across restarts.
          </p>
        </div>
      )}

      {/* Blur & Darkness */}
      <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--divider-color)' }}>
        <div>
          <label className="text-xs opacity-50 block mb-1">Blur: {bg.blur}px</label>
          <input
            type="range"
            min="0"
            max="30"
            value={bg.blur}
            onChange={(e) => update({ background: { ...bg, blur: parseInt(e.target.value) } })}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="text-xs opacity-50 block mb-1">
            Darkness: {Math.round(bg.darkness * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={bg.darkness}
            onChange={(e) => update({ background: { ...bg, darkness: parseFloat(e.target.value) } })}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
        {settings.theme === 'dark' && (
          <div>
            <label className="text-xs opacity-50 block mb-1">
              Panel Opacity: {Math.round(bg.glassOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={bg.glassOpacity}
              onChange={(e) => update({ background: { ...bg, glassOpacity: parseFloat(e.target.value) } })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
        )}
      </div>
    </>
  );
}

// ===== Grid Tab =====
function GridTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  const grid = settings.grid;

  return (
    <>
      <div>
        <label className="text-sm opacity-60 flex items-center gap-2 mb-2">
          <Grid3x3 size={14} />
          Columns: {grid.columns}
        </label>
        <input
          type="range"
          min="3"
          max="10"
          value={grid.columns}
          onChange={(e) =>
            update({ grid: { ...grid, columns: parseInt(e.target.value) } })
          }
          className="w-full accent-[var(--color-accent)]"
        />
      </div>

      <div>
        <label className="text-sm opacity-60 mb-2 block">Icon Size</label>
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map(size => (
            <button
              key={size}
              onClick={() => update({ grid: { ...grid, iconSize: size } })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all`}
              style={{
                cursor: 'pointer', fontFamily: 'inherit',
                borderColor: grid.iconSize === size ? 'var(--color-accent)' : 'var(--settings-option-border)',
                background: grid.iconSize === size ? 'var(--settings-selected-bg)' : 'transparent',
                color: grid.iconSize === size ? 'var(--color-accent)' : 'inherit',
              }}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm opacity-60">Show Labels</label>
        <button
          className={`nova-toggle ${grid.showLabels ? 'active' : ''}`}
          onClick={() => update({ grid: { ...grid, showLabels: !grid.showLabels } })}
        />
      </div>

      <div>
        <label className="text-sm opacity-60 mb-2 block">Grid Position</label>
        <div className="flex gap-2">
          {(['top', 'center', 'bottom'] as const).map(pos => (
            <button
              key={pos}
              onClick={() => update({ grid: { ...grid, position: pos } })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all`}
              style={{
                cursor: 'pointer', fontFamily: 'inherit',
                borderColor: grid.position === pos ? 'var(--color-accent)' : 'var(--settings-option-border)',
                background: grid.position === pos ? 'var(--settings-selected-bg)' : 'transparent',
                color: grid.position === pos ? 'var(--color-accent)' : 'inherit',
              }}
            >
              {pos.charAt(0).toUpperCase() + pos.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}


