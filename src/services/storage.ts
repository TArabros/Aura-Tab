import type { AppSettings, Shortcut, ShortcutFolder, AIChat, BackgroundSettings } from '@/types';

const DEFAULT_BACKGROUND: BackgroundSettings = {
  type: 'gradient',
  gradientStart: '#0f0c29',
  gradientEnd: '#302b63',
  gradientAngle: 135,
  blur: 0,
  darkness: 0.3,
  glassOpacity: 0.06,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  userName: '',
  background: DEFAULT_BACKGROUND,
  grid: {
    columns: 6,
    iconSize: 'medium',
    showLabels: true,
    position: 'center',
  },
  ai: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful, concise assistant. Answer clearly and helpfully. Use Markdown formatting when appropriate.',
  },
  aiPanelMode: 'hidden',
};

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    id: 'sc-google',
    title: 'Google',
    url: 'https://www.google.com',
    favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
    order: 0,
  },
  {
    id: 'sc-youtube',
    title: 'YouTube',
    url: 'https://www.youtube.com',
    favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    order: 1,
  },
  {
    id: 'sc-github',
    title: 'GitHub',
    url: 'https://www.github.com',
    favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
    order: 2,
  },
  {
    id: 'sc-x',
    title: 'X',
    url: 'https://x.com',
    favicon: 'https://www.google.com/s2/favicons?domain=x.com&sz=64',
    order: 3,
  },
  {
    id: 'sc-reddit',
    title: 'Reddit',
    url: 'https://www.reddit.com',
    favicon: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64',
    order: 4,
  },
  {
    id: 'sc-chatgpt',
    title: 'ChatGPT',
    url: 'https://chatgpt.com',
    favicon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64',
    order: 5,
  },
  {
    id: 'sc-spotify',
    title: 'Spotify',
    url: 'https://open.spotify.com',
    favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64',
    order: 6,
  },
  {
    id: 'sc-wikipedia',
    title: 'Wikipedia',
    url: 'https://www.wikipedia.org',
    favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64',
    order: 7,
  },
];

function isChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

// Unified storage: chrome.storage.local when available, otherwise localStorage fallback
async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        const val = result[key];
        resolve((val !== undefined ? val : defaultValue) as T);
      });
    });
  }
  const raw = localStorage.getItem(`nova_${key}`);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function storageSet(key: string, value: unknown): Promise<void> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }
  localStorage.setItem(`nova_${key}`, JSON.stringify(value));
}

// ===== Settings =====
export async function getSettings(): Promise<AppSettings> {
  return mergeWithDefaults(await storageGet<Partial<AppSettings>>('settings', DEFAULT_SETTINGS));
}

// Settings saved by older versions or restored from a backup may lack newer fields
function mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    background: { ...DEFAULT_SETTINGS.background, ...stored.background },
    grid: { ...DEFAULT_SETTINGS.grid, ...stored.grid },
    ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return storageSet('settings', settings);
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await saveSettings(updated);
  return updated;
}

// ===== Shortcuts =====
export async function getShortcuts(): Promise<Shortcut[]> {
  const initialized = await storageGet<boolean>('shortcuts_init', false);
  if (!initialized) {
    await storageSet('shortcuts_init', true);
    await saveShortcuts(DEFAULT_SHORTCUTS);
    return DEFAULT_SHORTCUTS;
  }
  return storageGet<Shortcut[]>('shortcuts', DEFAULT_SHORTCUTS);
}

export async function saveShortcuts(shortcuts: Shortcut[]): Promise<void> {
  return storageSet('shortcuts', shortcuts);
}

export async function addShortcut(shortcut: Shortcut): Promise<Shortcut[]> {
  const shortcuts = await getShortcuts();
  shortcuts.push(shortcut);
  await saveShortcuts(shortcuts);
  return shortcuts;
}

export async function removeShortcut(id: string): Promise<Shortcut[]> {
  let shortcuts = await getShortcuts();
  shortcuts = shortcuts.filter(s => s.id !== id);
  await saveShortcuts(shortcuts);
  return shortcuts;
}

export async function updateShortcut(id: string, data: Partial<Shortcut>): Promise<Shortcut[]> {
  const shortcuts = await getShortcuts();
  const idx = shortcuts.findIndex(s => s.id === id);
  if (idx !== -1) {
    shortcuts[idx] = { ...shortcuts[idx], ...data };
  }
  await saveShortcuts(shortcuts);
  return shortcuts;
}

// ===== Folders =====
export async function getFolders(): Promise<ShortcutFolder[]> {
  return storageGet<ShortcutFolder[]>('folders', []);
}

export async function saveFolders(folders: ShortcutFolder[]): Promise<void> {
  return storageSet('folders', folders);
}

// ===== AI Chats =====
export async function getAIChats(): Promise<AIChat[]> {
  return storageGet<AIChat[]>('aiChats', []);
}

export async function saveAIChats(chats: AIChat[]): Promise<void> {
  return storageSet('aiChats', chats);
}

export async function getCurrentChatId(): Promise<string | null> {
  return storageGet<string | null>('currentChatId', null);
}

export async function setCurrentChatId(id: string | null): Promise<void> {
  return storageSet('currentChatId', id);
}

// ===== Background Image (IndexedDB for large data) =====
const DB_NAME = 'NovaTabDB';
const DB_VERSION = 1;
const STORE_NAME = 'backgrounds';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBackgroundImage(dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, 'customBackground');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBackgroundImage(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get('customBackground');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

// ===== Export / Import =====
export async function exportAllData(): Promise<string> {
  const settings = await getSettings();
  const shortcuts = await getShortcuts();
  const folders = await getFolders();
  const chats = await getAIChats();
  // The API key stays on this device: backup files get shared and synced
  const safeSettings = { ...settings, ai: { ...settings.ai, apiKey: '' } };
  return JSON.stringify({ settings: safeSettings, shortcuts, folders, chats, version: 1 }, null, 2);
}

function isValidShortcut(s: Partial<Shortcut>): boolean {
  return typeof s?.id === 'string' && typeof s.title === 'string' &&
    typeof s.url === 'string' && /^https?:\/\//i.test(s.url);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const isBackup = data && typeof data === 'object' &&
    (data.settings || data.shortcuts || data.folders || data.chats);
  if (!isBackup) throw new Error('This file is not a Nova Tab backup');

  if (data.shortcuts && !(Array.isArray(data.shortcuts) && data.shortcuts.every(isValidShortcut))) {
    throw new Error('The backup contains invalid shortcuts');
  }
  if (data.folders && !Array.isArray(data.folders)) throw new Error('The backup contains invalid folders');
  if (data.chats && !Array.isArray(data.chats)) throw new Error('The backup contains invalid chats');

  if (data.settings) {
    const current = await getSettings();
    const restored = mergeWithDefaults(data.settings);
    restored.ai.apiKey = restored.ai.apiKey || current.ai.apiKey;
    await saveSettings(restored);
  }
  if (data.shortcuts) await saveShortcuts(data.shortcuts);
  if (data.folders) await saveFolders(data.folders);
  if (data.chats) await saveAIChats(data.chats);
}
