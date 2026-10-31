// Nova Tab — Background Service Worker (Manifest V3)
// Handles media session detection and messaging between content scripts and newtab

interface MediaInfo {
  tabId: number;
  origin: string;
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

const STORAGE_KEY = 'mediaSessions';
const activeSessions: Map<number, MediaInfo> = new Map();

// The worker is stopped when idle, so sessions are mirrored to session storage
const ready = chrome.storage.session.get(STORAGE_KEY).then((result) => {
  const saved = (result[STORAGE_KEY] ?? []) as MediaInfo[];
  for (const session of saved) {
    if (!activeSessions.has(session.tabId)) activeSessions.set(session.tabId, session);
  }
});

function updateSessions(change: () => void): Promise<void> {
  return ready.then(() => {
    change();
    return chrome.storage.session.set({ [STORAGE_KEY]: Array.from(activeSessions.values()) });
  });
}

function buildSession(tabId: number, url: string, payload: Partial<MediaInfo>, defaultPlaying: boolean): MediaInfo {
  return {
    tabId,
    origin: getOrigin(url),
    title: payload.title || '',
    artist: payload.artist || '',
    album: payload.album || '',
    artwork: payload.artwork || '',
    siteName: payload.siteName || extractSiteName(url),
    siteIcon: payload.siteIcon || getFaviconUrl(url),
    isPlaying: payload.isPlaying ?? defaultPlaying,
    supportsPrev: payload.supportsPrev ?? false,
    supportsNext: payload.supportsNext ?? false,
    duration: payload.duration ?? 0,
    currentTime: payload.currentTime ?? 0,
  };
}

// Listen for messages from content scripts and newtab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MEDIA_SESSION_UPDATE' && sender.tab?.id) {
    const tabId = sender.tab.id;
    const info = buildSession(tabId, sender.tab.url || '', message.payload, false);

    updateSessions(() => {
      if (!info.isPlaying && !info.title) {
        activeSessions.delete(tabId);
      } else {
        activeSessions.set(tabId, info);
      }
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_MEDIA_SESSIONS') {
    ready.then(() => sendResponse({ sessions: Array.from(activeSessions.values()) }));
    return true;
  }

  if (message.type === 'MEDIA_CONTROL') {
    const { tabId, action } = message.payload;
    chrome.tabs.sendMessage(tabId, { type: 'MEDIA_CONTROL', action }, () => {
      if (chrome.runtime.lastError) {
        // Tab might have been closed
        updateSessions(() => activeSessions.delete(tabId));
      }
    });
    sendResponse({ success: true });
  }

  if (message.type === 'SWITCH_TO_TAB') {
    const { tabId } = message.payload;
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        updateSessions(() => activeSessions.delete(tabId));
        return;
      }
      // The tab may live in another window
      if (tab?.windowId !== undefined) {
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
    sendResponse({ success: true });
  }
});

// Clean up sessions when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  updateSessions(() => activeSessions.delete(tabId));
});

// Clean up sessions when a tab leaves the site; same-site navigation keeps playing
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const newOrigin = getOrigin(changeInfo.url);
  updateSessions(() => {
    const session = activeSessions.get(tabId);
    if (session && session.origin !== newOrigin) activeSessions.delete(tabId);
  });
});

// Periodic query for audible tabs to catch sessions we might have missed
chrome.alarms.create('checkMedia', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMedia') {
    chrome.tabs.query({ audible: true }, async (tabs) => {
      await ready;
      for (const tab of tabs) {
        const tabId = tab.id;
        if (tabId && !activeSessions.has(tabId)) {
          // Request info from content script
          chrome.tabs.sendMessage(tabId, { type: 'GET_MEDIA_INFO' }, (response) => {
            if (chrome.runtime.lastError || !response) return;
            if (response.title) {
              updateSessions(() => {
                activeSessions.set(tabId, buildSession(tabId, tab.url || '', response, true));
              });
            }
          });
        }
      }
    });
  }
});

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function extractSiteName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Unknown';
  }
}

function getFaviconUrl(url: string): string {
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
}
