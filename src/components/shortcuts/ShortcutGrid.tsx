import { useState, useCallback, useRef, useEffect } from 'react';
import type { Shortcut, ShortcutFolder, GridSettings } from '@/types';
import { saveShortcuts, saveFolders } from '@/services/storage';
import ShortcutItem from './ShortcutItem';
import AddShortcutModal from './AddShortcutModal';
import FolderView from './FolderView';
import { Plus, FolderPlus, MoreVertical, FolderMinus } from 'lucide-react';

interface Props {
  shortcuts: Shortcut[];
  folders: ShortcutFolder[];
  onShortcutsChange: (s: Shortcut[]) => void;
  onFoldersChange: (f: ShortcutFolder[]) => void;
  gridSettings: GridSettings;
}

export default function ShortcutGrid({
  shortcuts,
  folders,
  onShortcutsChange,
  onFoldersChange,
  gridSettings,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  // Get root-level shortcuts (not in folders) sorted by order
  const rootShortcuts = shortcuts
    .filter(s => !s.folderId)
    .sort((a, b) => a.order - b.order);

  const sortedFolders = [...folders].sort((a, b) => a.order - b.order);

  const handleAdd = useCallback(async (shortcut: Shortcut) => {
    const updated = [...shortcuts, shortcut];
    onShortcutsChange(updated);
    await saveShortcuts(updated);
    setShowAddModal(false);
  }, [shortcuts, onShortcutsChange]);

  const handleEdit = useCallback(async (shortcut: Shortcut) => {
    const updated = shortcuts.map(s => s.id === shortcut.id ? shortcut : s);
    onShortcutsChange(updated);
    await saveShortcuts(updated);
    setEditingShortcut(null);
  }, [shortcuts, onShortcutsChange]);

  const handleDelete = useCallback(async (id: string) => {
    const updated = shortcuts.filter(s => s.id !== id);
    onShortcutsChange(updated);
    await saveShortcuts(updated);
    setActiveMenuId(null);
  }, [shortcuts, onShortcutsChange]);

  const handleAddFolder = useCallback(async () => {
    const newFolder: ShortcutFolder = {
      id: crypto.randomUUID(),
      title: 'New Folder',
      order: folders.length,
      isOpen: false,
    };
    const updated = [...folders, newFolder];
    onFoldersChange(updated);
    await saveFolders(updated);
  }, [folders, onFoldersChange]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    // Move shortcuts out of folder
    const updated = shortcuts.map(s =>
      s.folderId === folderId ? { ...s, folderId: undefined } : s
    );
    onShortcutsChange(updated);
    await saveShortcuts(updated);

    const updatedFolders = folders.filter(f => f.id !== folderId);
    onFoldersChange(updatedFolders);
    await saveFolders(updatedFolders);
    setActiveMenuId(null);
  }, [shortcuts, folders, onShortcutsChange, onFoldersChange]);

  const handleRenameFolder = useCallback(async (folderId: string, title: string) => {
    const updated = folders.map(f => f.id === folderId ? { ...f, title } : f);
    onFoldersChange(updated);
    await saveFolders(updated);
  }, [folders, onFoldersChange]);

  // Drag and drop
  const handleDragStart = (id: string) => {
    dragItemRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = useCallback(async (targetId: string) => {
    const dragId = dragItemRef.current;
    if (!dragId || dragId === targetId) {
      setDragOverId(null);
      return;
    }

    // Check if dropping onto a folder
    const targetFolder = folders.find(f => f.id === targetId);
    if (targetFolder) {
      const updated = shortcuts.map(s =>
        s.id === dragId ? { ...s, folderId: targetId } : s
      );
      onShortcutsChange(updated);
      await saveShortcuts(updated);
      setDragOverId(null);
      return;
    }

    // Reorder shortcuts
    const dragIdx = rootShortcuts.findIndex(s => s.id === dragId);
    const targetIdx = rootShortcuts.findIndex(s => s.id === targetId);

    if (dragIdx === -1 || targetIdx === -1) {
      setDragOverId(null);
      return;
    }

    const reordered = [...rootShortcuts];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const updated = shortcuts.map(s => {
      const newIdx = reordered.findIndex(r => r.id === s.id);
      if (newIdx !== -1) return { ...s, order: newIdx };
      return s;
    });

    onShortcutsChange(updated);
    await saveShortcuts(updated);
    setDragOverId(null);
  }, [shortcuts, rootShortcuts, folders, onShortcutsChange]);

  const gridCols = gridSettings.columns || 6;

  return (
    <div
      className="w-full max-w-4xl animate-fade-in"
      style={{ animationDelay: '0.3s' }}
    >
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {/* Folders */}
        {sortedFolders.map(folder => (
          <div
            key={folder.id}
            role="button"
            tabIndex={0}
            className={`glass-card relative flex flex-col items-center justify-center gap-2 p-4 cursor-pointer group
              ${dragOverId === folder.id ? 'shortcut-drag-over' : ''}
              ${activeMenuId === folder.id ? 'z-40 ring-2 ring-[var(--color-accent)]/50' : ''}`}
            style={{ minHeight: 90 }}
            onClick={() => setOpenFolder(folder.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') setOpenFolder(folder.id); }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveMenuId(prev => prev === folder.id ? null : folder.id);
            }}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(folder.id)}
          >
            {/* 3 dots button for folder */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setActiveMenuId(prev => prev === folder.id ? null : folder.id);
              }}
              className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center
                transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                hover:bg-[var(--nova-btn-icon-hover-bg)] cursor-pointer z-20
                ${activeMenuId === folder.id ? 'opacity-100 bg-[var(--nova-btn-icon-hover-bg)] text-[var(--color-text-primary)]' : 'opacity-0 group-hover:opacity-100'}`}
              style={{ border: 'none' }}
              title="Действия"
            >
              <MoreVertical size={16} />
            </button>

            {/* Folder Dropdown Menu */}
            {activeMenuId === folder.id && (
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
                    handleDeleteFolder(folder.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium cursor-pointer transition-colors
                    text-[var(--color-error)] hover:bg-[var(--error-bg)]"
                  style={{ border: 'none', background: 'transparent' }}
                >
                  <FolderMinus size={15} />
                  <span>Удалить папку</span>
                </button>
              </div>
            )}

            <FolderPlus size={28} className="opacity-60" />
            {gridSettings.showLabels && (
              <span className="text-xs opacity-60 truncate w-full text-center">
                {folder.title}
              </span>
            )}
          </div>
        ))}

        {/* Shortcuts */}
        {rootShortcuts.map(shortcut => (
          <ShortcutItem
            key={shortcut.id}
            shortcut={shortcut}
            showLabel={gridSettings.showLabels}
            iconSize={gridSettings.iconSize}
            isDragOver={dragOverId === shortcut.id}
            isMenuOpen={activeMenuId === shortcut.id}
            onDragStart={() => handleDragStart(shortcut.id)}
            onDragOver={(e) => handleDragOver(e, shortcut.id)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(shortcut.id)}
            onContextMenu={() => setActiveMenuId(shortcut.id)}
            onToggleMenu={() => setActiveMenuId(prev => prev === shortcut.id ? null : shortcut.id)}
            onDelete={() => handleDelete(shortcut.id)}
            onEdit={() => {
              setEditingShortcut(shortcut);
              setActiveMenuId(null);
            }}
          />
        ))}

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="glass-card flex flex-col items-center justify-center gap-2 p-4 cursor-pointer
            border-dashed! hover:border-[var(--color-accent)]/50 group"
          style={{ minHeight: 90 }}
        >
          <Plus
            size={24}
            className="group-hover:text-[var(--color-accent)] group-hover:scale-110 transition-all duration-300"
            style={{ color: 'var(--color-text-muted)' }}
          />
          {gridSettings.showLabels && (
            <span
              className="text-xs group-hover:opacity-100 transition-opacity font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Add site
            </span>
          )}
        </button>

        {/* Add folder button */}
        <button
          onClick={handleAddFolder}
          className="glass-card flex flex-col items-center justify-center gap-2 p-4 cursor-pointer
            border-dashed! hover:border-[var(--color-accent)]/50 group"
          style={{ minHeight: 90 }}
        >
          <FolderPlus
            size={24}
            className="group-hover:text-[var(--color-accent)] group-hover:scale-110 transition-all duration-300"
            style={{ color: 'var(--color-text-muted)' }}
          />
          {gridSettings.showLabels && (
            <span
              className="text-xs group-hover:opacity-100 transition-opacity font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Add folder
            </span>
          )}
        </button>
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingShortcut) && (
        <AddShortcutModal
          shortcut={editingShortcut}
          existingCount={shortcuts.length}
          onSave={editingShortcut ? handleEdit : handleAdd}
          onClose={() => { setShowAddModal(false); setEditingShortcut(null); }}
        />
      )}

      {/* Folder View */}
      {openFolder && (
        <FolderView
          folder={folders.find(f => f.id === openFolder)!}
          shortcuts={shortcuts.filter(s => s.folderId === openFolder)}
          allShortcuts={shortcuts}
          onClose={() => setOpenFolder(null)}
          onShortcutsChange={async (updated) => {
            onShortcutsChange(updated);
            await saveShortcuts(updated);
          }}
          onRename={(title) => handleRenameFolder(openFolder, title)}
          onRemoveFromFolder={async (id) => {
            const updated = shortcuts.map(s =>
              s.id === id ? { ...s, folderId: undefined } : s
            );
            onShortcutsChange(updated);
            await saveShortcuts(updated);
          }}
        />
      )}

      {/* Invisible backdrop to close menu on outside click */}
      {activeMenuId && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setActiveMenuId(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setActiveMenuId(null);
          }}
        />
      )}
    </div>
  );
}
