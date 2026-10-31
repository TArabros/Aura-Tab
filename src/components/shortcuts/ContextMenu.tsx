import { Edit3, Trash2, ExternalLink, FolderMinus } from 'lucide-react';

interface Props {
  x: number;
  y: number;
  shortcutId?: string;
  shortcutUrl?: string;
  folderId?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  shortcutId,
  shortcutUrl,
  folderId,
  onEdit,
  onDelete,
  onDeleteFolder,
  onClose,
}: Props) {
  // Adjust position to keep menu in viewport
  const adjustedX = Math.max(10, Math.min(x, window.innerWidth - 190));
  const adjustedY = Math.max(10, Math.min(y, window.innerHeight - 200));

  if (shortcutId) {
    return (
      <div
        className="context-menu"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="context-menu-item danger text-[var(--color-error)]"
          onClick={() => onDelete(shortcutId)}
        >
          <Trash2 size={15} />
          Удалить
        </button>
        <div className="context-menu-divider" />
        <button
          className="context-menu-item"
          onClick={() => onEdit(shortcutId)}
        >
          <Edit3 size={15} />
          Редактировать
        </button>
        <button
          className="context-menu-item"
          onClick={() => {
            const sc = document.querySelector(`[data-id="${shortcutId}"]`);
            const url = shortcutUrl || sc?.getAttribute('data-url');
            if (url) window.open(url, '_blank');
            onClose();
          }}
        >
          <ExternalLink size={15} />
          Открыть в новой вкладке
        </button>
      </div>
    );
  }

  if (folderId) {
    return (
      <div
        className="context-menu"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="context-menu-item danger text-[var(--color-error)]"
          onClick={() => onDeleteFolder(folderId)}
        >
          <FolderMinus size={15} />
          Удалить папку
        </button>
      </div>
    );
  }

  return null;
}
