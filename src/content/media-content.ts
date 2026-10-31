// Nova Tab — Content Script for media session detection
// Injected into supported media sites to detect and control playback

type ControlName = 'play' | 'next' | 'prev';

// Player buttons per site. More specific hosts go first.
const SITE_CONTROLS: { host: string; selectors: Record<ControlName, string> }[] = [
  {
    host: 'music.youtube.com',
    selectors: { play: '#play-pause-button', next: '.next-button', prev: '.previous-button' },
  },
  {
    host: 'youtube.com',
    selectors: { play: '.ytp-play-button', next: '.ytp-next-button', prev: '.ytp-prev-button' },
  },
  {
    host: 'spotify.com',
    selectors: {
      play: '[data-testid="control-button-playpause"]',
      next: '[data-testid="control-button-skip-forward"]',
      prev: '[data-testid="control-button-skip-back"]',
    },
  },
  {
    host: 'soundcloud.com',
    selectors: { play: '.playControl', next: '.skipControl__next', prev: '.skipControl__previous' },
  },
];

function findControl(name: ControlName): HTMLElement | null {
  const hostname = window.location.hostname;
  const site = SITE_CONTROLS.find(s => hostname === s.host || hostname.endsWith(`.${s.host}`));
  if (!site) return null;

  const el = document.querySelector<HTMLElement>(site.selectors[name]);
  if (!el || el.getClientRects().length === 0) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  return el;
}

function findActiveMedia(): HTMLMediaElement | undefined {
  const mediaElements = Array.from(document.querySelectorAll('video, audio')) as HTMLMediaElement[];
  return mediaElements.find(m => !m.paused) ||
    mediaElements.find(m => m.currentTime > 0) ||
    mediaElements[0];
}

function getMediaInfo() {
  // Try to get info from Media Session API first
  const ms = navigator.mediaSession;
  const metadata = ms?.metadata;

  const activeMedia = findActiveMedia();
  const isPlaying = activeMedia ? !activeMedia.paused : ms?.playbackState === 'playing';

  // A page that has never started playback is not a media session
  const hasSession = isPlaying || !!metadata?.title || (activeMedia?.currentTime ?? 0) > 0;
  if (!hasSession) {
    return { title: '', isPlaying: false };
  }

  const hostname = window.location.hostname;
  let siteName = hostname.replace('www.', '').split('.')[0];
  siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);

  // Site-specific title extraction
  let title = metadata?.title || '';
  let artist = metadata?.artist || '';
  const album = metadata?.album || '';
  let artwork = '';

  if (metadata?.artwork && metadata.artwork.length > 0) {
    const best = metadata.artwork.reduce((a, b) => {
      const aSize = (a.sizes?.split('x').map(Number)[0]) || 0;
      const bSize = (b.sizes?.split('x').map(Number)[0]) || 0;
      return bSize > aSize ? b : a;
    });
    artwork = best.src;
  }

  // YouTube-specific fallbacks
  if (hostname.includes('youtube.com') && !title) {
    const titleEl = document.querySelector('yt-formatted-string.style-scope.ytd-watch-metadata') ||
                    document.querySelector('#title h1 yt-formatted-string') ||
                    document.querySelector('.title.style-scope.ytd-video-primary-info-renderer');
    if (titleEl) title = titleEl.textContent?.trim() || '';

    const channelEl = document.querySelector('#channel-name a') ||
                      document.querySelector('ytd-channel-name a');
    if (channelEl) artist = channelEl.textContent?.trim() || '';

    const thumbEl = document.querySelector('meta[property="og:image"]');
    if (thumbEl && !artwork) artwork = thumbEl.getAttribute('content') || '';
  }

  // Spotify-specific fallbacks
  if (hostname.includes('spotify.com') && !title) {
    const titleEl = document.querySelector('[data-testid="context-item-info-title"]') ||
                    document.querySelector('.track-info__name a');
    if (titleEl) title = titleEl.textContent?.trim() || '';

    const artistEl = document.querySelector('[data-testid="context-item-info-artist"]') ||
                     document.querySelector('.track-info__artists a');
    if (artistEl) artist = artistEl.textContent?.trim() || '';
  }

  // SoundCloud fallbacks
  if (hostname.includes('soundcloud.com') && !title) {
    const titleEl = document.querySelector('.playbackSoundBadge__titleLink');
    if (titleEl) title = titleEl.getAttribute('title') || titleEl.textContent?.trim() || '';

    const artistEl = document.querySelector('.playbackSoundBadge__lightLink');
    if (artistEl) artist = artistEl.textContent?.trim() || '';
  }

  // Last resort: page title
  if (!title) {
    title = document.title
      .replace(/ - YouTube$/, '')
      .replace(/ \| Spotify.*$/, '')
      .replace(/ on SoundCloud$/, '')
      .trim();
  }

  return {
    title,
    artist,
    album,
    artwork: artwork || '',
    siteName,
    siteIcon: `${window.location.origin}/favicon.ico`,
    isPlaying,
    supportsPrev: !!findControl('prev'),
    supportsNext: !!findControl('next'),
    duration: activeMedia?.duration || 0,
    currentTime: activeMedia?.currentTime || 0,
  };
}

// Send media updates to background
function sendUpdate() {
  try {
    const info = getMediaInfo();
    chrome.runtime.sendMessage({
      type: 'MEDIA_SESSION_UPDATE',
      payload: info,
    }).catch(() => {});
  } catch {
    // Extension context might be invalidated
  }
}

// Listen for control commands
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MEDIA_CONTROL') {
    const activeMedia = findActiveMedia();

    switch (message.action) {
      case 'play':
        // Some players (Spotify) keep their media element outside the DOM
        if (activeMedia) activeMedia.play().catch(() => {});
        else findControl('play')?.click();
        break;
      case 'pause':
        if (activeMedia) activeMedia.pause();
        else findControl('play')?.click();
        break;
      case 'next':
        findControl('next')?.click();
        break;
      case 'prev':
        findControl('prev')?.click();
        break;
    }
    setTimeout(sendUpdate, 300);
    sendResponse({ success: true });
  }

  if (message.type === 'GET_MEDIA_INFO') {
    sendResponse(getMediaInfo());
  }
});

// Watch for media events
function setupMediaListeners() {
  const observer = new MutationObserver(() => {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(el => {
      if (!(el as HTMLMediaElement).dataset.novaTabListener) {
        (el as HTMLMediaElement).dataset.novaTabListener = 'true';
        el.addEventListener('play', sendUpdate);
        el.addEventListener('pause', sendUpdate);
        el.addEventListener('ended', sendUpdate);
        el.addEventListener('timeupdate', throttledSendUpdate);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach(el => {
    (el as HTMLMediaElement).dataset.novaTabListener = 'true';
    el.addEventListener('play', sendUpdate);
    el.addEventListener('pause', sendUpdate);
    el.addEventListener('ended', sendUpdate);
    el.addEventListener('timeupdate', throttledSendUpdate);
  });
}

let lastUpdate = 0;
function throttledSendUpdate() {
  const now = Date.now();
  if (now - lastUpdate > 2000) {
    lastUpdate = now;
    sendUpdate();
  }
}

// Also check periodically
setInterval(sendUpdate, 5000);

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMediaListeners);
} else {
  setupMediaListeners();
}

// Initial update
setTimeout(sendUpdate, 1000);
