import { MoreVertical, Trash2, Edit3, ExternalLink } from 'lucide-react';
import type { GridSettings, Shortcut } from '@/types';

const ICON_SIZES: Record<GridSettings['iconSize'], { box: number; image: number }> = {
  small: { box: 36, image: 22 },
  medium: { box: 44, image: 28 },
  large: { box: 60, image: 40 },
};

interface Props {
  shortcut: Shortcut;
  showLabel: boolean;
  iconSize: GridSettings['iconSize'];
  isDragOver: boolean;
  isMenuOpen: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleMenu: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export default function ShortcutItem({
  shortcut,
  showLabel,
  iconSize,
  isDragOver,
  isMenuOpen,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onContextMenu,
  onToggleMenu,
  onDelete,
  onEdit,
}: Props) {
  const handleClick = () => {
    window.open(shortcut.url, '_self');
  };

  const faviconUrl = shortcut.favicon ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(shortcut.url).hostname)}&sz=64`;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      data-id={shortcut.id}
      data-url={shortcut.url}
      className={`
        glass-card relative flex flex-col items-center justify-center gap-2.5 p-4 cursor-pointer
        group transition-all duration-300 select-none
        hover:scale-105 hover:shadow-lg
        ${isDragOver ? 'shortcut-drag-over' : ''}
        ${isMenuOpen ? 'z-40 ring-2 ring-[var(--color-accent)]/50' : ''}
      `}
      style={{ minHeight: 90 }}
      title={shortcut.title}
    >
      {/* 3 dots action button in top-right corner */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleMenu();
        }}
        className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center
          transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
          hover:bg-[var(--nova-btn-icon-hover-bg)] cursor-pointer z-20
          ${isMenuOpen ? 'opacity-100 bg-[var(--nova-btn-icon-hover-bg)] text-[var(--color-text-primary)]' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ border: 'none' }}
        title="Действия"
      >
        <MoreVertical size={16} />
      </button>

      {/* Dropdown Menu attached directly to card */}
      {isMenuOpen && (
        <div
          className="absolute top-9 right-2 z-50 p-1.5 rounded-xl shadow-2xl border animate-scale-in"
          style={{
            background: 'var(--ai-panel-bg)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            borderColor: 'var(--ai-panel-border)',
            minWidth: '150px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium cursor-pointer transition-colors
              text-[var(--color-error)] hover:bg-[var(--error-bg)]"
            style={{ border: 'none', background: 'transparent' }}
          >
            <Trash2 size={15} />
            <span>Удалить</span>
          </button>

          <div className="h-[1px] my-1" style={{ background: 'var(--divider-color)' }} />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium cursor-pointer transition-colors
              text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--nova-btn-icon-hover-bg)]"
            style={{ border: 'none', background: 'transparent' }}
          >
            <Edit3 size={15} />
            <span>Редактировать</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(shortcut.url, '_blank');
              onToggleMenu();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium cursor-pointer transition-colors
              text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--nova-btn-icon-hover-bg)]"
            style={{ border: 'none', background: 'transparent' }}
          >
            <ExternalLink size={15} />
            <span>В новой вкладке</span>
          </button>
        </div>
      )}

      <div className="relative">
        <div className="rounded-xl flex items-center justify-center
          overflow-hidden transition-all duration-300"
          style={{
            width: ICON_SIZES[iconSize].box,
            height: ICON_SIZES[iconSize].box,
            background: 'var(--shortcut-icon-bg)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--shortcut-icon-hover-bg)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--shortcut-icon-bg)';
          }}
        >
          <img
            src={faviconUrl}
            alt={shortcut.title}
            className="object-contain"
            style={{ width: ICON_SIZES[iconSize].image, height: ICON_SIZES[iconSize].image }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const letter = document.createElement('span');
                letter.textContent = shortcut.title.charAt(0).toUpperCase();
                letter.className = 'text-lg font-semibold opacity-60';
                parent.appendChild(letter);
              }
            }}
          />
        </div>
      </div>
      {showLabel && (
        <span className="text-[11px] opacity-50 group-hover:opacity-80 transition-opacity
          truncate w-full text-center leading-tight font-medium">
          {shortcut.title}
        </span>
      )}
    </div>
  );
}
