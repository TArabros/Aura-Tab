// ===== Shortcuts =====
export interface Shortcut {
  id: string;
  title: string;
  url: string;
  favicon: string;
  order: number;
  folderId?: string;
}

export interface ShortcutFolder {
  id: string;
  title: string;
  order: number;
  isOpen: boolean;
}

// ===== Media =====
export interface MediaSession {
  tabId: number;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  siteName: string;
  siteIcon: string;
  isPlaying: boolean;
  supportsPrev: boolean;
  supportsNext: boolean;
  duration: number;
  currentTime: number;
}

// ===== AI =====
export type AIPanelMode = 'hidden' | 'compact' | 'expanded';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIChat {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AISettings {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

// ===== Settings =====
export type ThemeMode = 'dark' | 'light';

export type BackgroundType = 'preset' | 'custom' | 'gradient' | 'solid';

export interface BackgroundPreset {
  id: string;
  name: string;
  category: string;
  url: string;
  thumbnail: string;
}

export interface BackgroundSettings {
  type: BackgroundType;
  presetId?: string;
  customImageData?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  solidColor?: string;
  blur: number;
  darkness: number;
  glassOpacity: number;
}

export interface GridSettings {
  columns: number;
  iconSize: 'small' | 'medium' | 'large';
  showLabels: boolean;
  position: 'center' | 'top' | 'bottom';
}

export interface AppSettings {
  theme: ThemeMode;
  userName: string;
  background: BackgroundSettings;
  grid: GridSettings;
  ai: AISettings;
  aiPanelMode: AIPanelMode;
  _themeInitialized?: boolean;
}

// ===== Messages =====
export type MessageType =
  | 'GET_MEDIA_SESSIONS'
  | 'MEDIA_SESSION_UPDATE'
  | 'MEDIA_CONTROL'
  | 'GET_MEDIA_INFO'
  | 'MEDIA_INFO_RESPONSE';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface MediaControlPayload {
  tabId: number;
  action: 'play' | 'pause' | 'next' | 'prev';
}
