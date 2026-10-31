import { useState } from 'react';
import type { Shortcut } from '@/types';
import { Globe, X } from 'lucide-react';

interface Props {
  shortcut: Shortcut | null;
  existingCount: number;
  onSave: (shortcut: Shortcut) => void;
  onClose: () => void;
}

export default function AddShortcutModal({ shortcut, existingCount, onSave, onClose }: Props) {
  const [url, setUrl] = useState(shortcut?.url || '');
  const [title, setTitle] = useState(shortcut?.title || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!shortcut;

  const handleUrlBlur = async () => {
    if (!url.trim() || title.trim()) return;

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
      setUrl(normalizedUrl);
      // Try to extract title from URL
      const hostname = new URL(normalizedUrl).hostname.replace('www.', '');
      const name = hostname.split('.')[0];
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    } catch {
      // Invalid URL, do nothing yet
    }
  };

  const handleSave = async () => {
    let normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setError('Please enter a URL');
      return;
    }

    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError('Invalid URL');
      return;
    }

    setLoading(true);
    setError('');

    const hostname = new URL(normalizedUrl).hostname;
    const autoTitle = title.trim() || hostname.replace('www.', '').split('.')[0];
    const finalTitle = autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1);

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;

    const saved: Shortcut = {
      id: shortcut?.id || crypto.randomUUID(),
      title: finalTitle,
      url: normalizedUrl,
      favicon: faviconUrl,
      order: shortcut?.order ?? existingCount,
      folderId: shortcut?.folderId,
    };

    onSave(saved);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe size={20} className="text-[var(--color-accent)]" />
            {isEditing ? 'Edit Shortcut' : 'Add Shortcut'}
          </h2>
          <button onClick={onClose} className="nova-btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm opacity-50 block mb-1.5">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onBlur={handleUrlBlur}
              placeholder="https://example.com"
              className="nova-input"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm opacity-50 block mb-1.5">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-detected from URL"
              className="nova-input"
            />
          </div>

          {error && (
            <p className="text-[var(--color-error)] text-sm">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="nova-btn nova-btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="nova-btn nova-btn-primary"
          >
            {loading ? 'Saving...' : isEditing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
