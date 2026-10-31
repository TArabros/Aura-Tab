import type { Shortcut, ShortcutFolder } from '@/types';
import { X, ExternalLink, FolderOpen } from 'lucide-react';

interface Props {
  folder: ShortcutFolder;
  shortcuts: Shortcut[];
  allShortcuts: Shortcut[];
  onClose: () => void;
  onShortcutsChange: (shortcuts: Shortcut[]) => void;
  onRename: (title: string) => void;
  onRemoveFromFolder: (id: string) => void;
}

export default function FolderView({
  folder,
  shortcuts,
  onClose,
  onRename,
  onRemoveFromFolder,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <FolderOpen size={22} className="text-[var(--color-accent)]" />
            <input
              type="text"
              value={folder.title}
              onChange={(e) => onRename(e.target.value)}
              className="bg-transparent border-none outline-none text-lg font-semibold"
              style={{ width: 'auto', minWidth: 60 }}
            />
          </div>
          <button onClick={onClose} className="nova-btn-icon">
            <X size={18} />
          </button>
        </div>

        {shortcuts.length === 0 ? (
          <div className="text-center py-12 opacity-40">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">This folder is empty</p>
            <p className="text-xs mt-1">Drag shortcuts here to organize them</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {shortcuts.sort((a, b) => a.order - b.order).map(shortcut => {
              const faviconUrl = shortcut.favicon ||
                `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(shortcut.url).hostname)}&sz=64`;

              return (
                <div
                  key={shortcut.id}
                  className="folder-item flex items-center gap-3 p-3 rounded-xl group cursor-pointer"
                  onClick={() => window.open(shortcut.url, '_self')}
                >
                  <img src={faviconUrl} alt="" className="w-8 h-8 rounded-lg object-contain" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{shortcut.title}</p>
                    <p className="text-xs opacity-40 truncate">{shortcut.url}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="nova-btn-icon"
                      onClick={(e) => { e.stopPropagation(); window.open(shortcut.url, '_blank'); }}
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      className="nova-btn-icon text-[var(--color-error)]"
                      onClick={(e) => { e.stopPropagation(); onRemoveFromFolder(shortcut.id); }}
                      title="Remove from folder"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
