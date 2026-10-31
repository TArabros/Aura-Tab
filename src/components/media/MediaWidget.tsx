import { useState, useEffect, useCallback } from 'react';
import type { MediaSession } from '@/types';
import {
  Play, Pause, SkipBack, SkipForward,
  Music, ExternalLink, ChevronDown, ChevronUp,
  Volume2
} from 'lucide-react';

export default function MediaWidget() {
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  const fetchSessions = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      setIsAvailable(false);
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'GET_MEDIA_SESSIONS' }, (response) => {
        if (chrome.runtime.lastError) {
          setIsAvailable(false);
          return;
        }
        if (response?.sessions) {
          setSessions(response.sessions);
          if (activeIdx >= response.sessions.length) {
            setActiveIdx(0);
          }
        }
      });
    } catch {
      setIsAvailable(false);
    }
  }, [activeIdx]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleControl = (tabId: number, action: string) => {
    if (!isAvailable) return;
    try {
      chrome.runtime.sendMessage({
        type: 'MEDIA_CONTROL',
        payload: { tabId, action },
      });
      // Update local state optimistically
      setSessions(prev =>
        prev.map(s =>
          s.tabId === tabId
            ? { ...s, isPlaying: action === 'play' ? true : action === 'pause' ? false : s.isPlaying }
            : s
        )
      );
    } catch {
      // Extension context unavailable
    }
  };

  const handleSwitchTab = (tabId: number) => {
    if (!isAvailable) return;
    try {
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', payload: { tabId } });
    } catch {
      // Extension context unavailable
    }
  };

  // Nothing playing
  if (sessions.length === 0) {
    return (
      <div
        className="glass-card-static flex items-center gap-2 px-3 py-1.5 opacity-30 hover:opacity-70 transition-opacity cursor-default select-none text-xs"
        title="No media playing in other tabs. Open YouTube, Spotify, etc. to control playback."
      >
        <Music size={13} className="text-[var(--color-accent)]" />
        <span>Media Idle</span>
      </div>
    );
  }

  const current = sessions[activeIdx] || sessions[0];

  return (
    <div className="relative">
      {/* Main player card */}
      <div className="glass-card-static flex items-center gap-3 px-4 py-2.5 animate-slide-up"
        style={{ minWidth: 280, maxWidth: 420 }}
      >
        {/* Artwork */}
        <div
          className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--shortcut-icon-bg)' }}
        >
          {current.artwork ? (
            <img src={current.artwork} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={18} className="opacity-40" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 mr-1">
          <p className="text-sm font-medium truncate leading-tight" title={current.title}>
            {current.title || 'Untitled Playback'}
          </p>
          <div className="flex items-center gap-1.5 text-xs opacity-50 truncate mt-0.5">
            {current.siteIcon && (
              <img
                src={current.siteIcon}
                alt=""
                className="w-3.5 h-3.5 rounded-sm object-contain"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            )}
            <span className="truncate">{current.artist || current.siteName || 'Web Player'}</span>
            {current.isPlaying && (
              <Volume2 size={11} className="text-[var(--color-accent)] animate-pulse flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <button
            className={`nova-btn-icon ${!current.supportsPrev ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
            onClick={() => current.supportsPrev && handleControl(current.tabId, 'prev')}
            disabled={!current.supportsPrev}
            title={current.supportsPrev ? 'Previous track' : 'Previous track not supported on this site'}
            style={{ padding: 5 }}
          >
            <SkipBack size={14} />
          </button>
          <button
            className="nova-btn-icon hover:text-[var(--color-accent)]"
            onClick={() => handleControl(current.tabId, current.isPlaying ? 'pause' : 'play')}
            title={current.isPlaying ? 'Pause' : 'Play'}
            style={{ padding: 5 }}
          >
            {current.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className={`nova-btn-icon ${!current.supportsNext ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
            onClick={() => current.supportsNext && handleControl(current.tabId, 'next')}
            disabled={!current.supportsNext}
            title={current.supportsNext ? 'Next track' : 'Next track not supported on this site'}
            style={{ padding: 5 }}
          >
            <SkipForward size={14} />
          </button>
          <button
            className="nova-btn-icon"
            onClick={() => handleSwitchTab(current.tabId)}
            title="Switch to tab"
            style={{ padding: 5 }}
          >
            <ExternalLink size={13} />
          </button>
          {sessions.length > 1 && (
            <button
              className="nova-btn-icon text-[var(--color-accent)]"
              onClick={() => setExpanded(!expanded)}
              title="Show all media sources"
              style={{ padding: 5 }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Session list (multiple sources) */}
      {expanded && sessions.length > 1 && (
        <div className="absolute top-full left-0 mt-2 glass-card-static p-2 w-full z-50 animate-scale-in">
          {sessions.map((session, idx) => (
            <button
              key={session.tabId}
              className="flex items-center gap-3 w-full p-2.5 rounded-lg text-left transition-colors folder-item"
              onClick={() => { setActiveIdx(idx); setExpanded(false); }}
              style={{
                border: 'none',
                background: idx === activeIdx ? 'var(--chat-active-bg)' : 'transparent',
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit'
              }}
            >
              <div
                className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--shortcut-icon-bg)' }}
              >
                {session.artwork ? (
                  <img src={session.artwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music size={14} className="opacity-40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session.title || 'Unknown'}</p>
                <p className="text-[10px] opacity-40 truncate">{session.siteName}</p>
              </div>
              {session.isPlaying && (
                <Volume2 size={12} className="text-[var(--color-accent)] animate-pulse flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
