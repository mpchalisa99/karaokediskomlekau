/**
 * Cross-browser Fullscreen Controller with Vendor Prefixes for Smart TVs (Samsung Tizen, LG webOS, Android TV)
 * Supports standard requestFullscreen, webkitRequestFullscreen, mozRequestFullScreen, and msRequestFullscreen.
 */

export function isSamsungSmartTv(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Tizen|SMART-TV.*Samsung|SamsungBrowser.*TV|SmartTV.*Tizen|Maple/i.test(ua)) {
    return true;
  }
  if (typeof (window as any).tizen !== 'undefined') {
    return true;
  }
  return false;
}

export function isSmartTvDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (
    /SMART-TV|Tizen|SmartTV|webOS|NetCast|Android.*TV|BRAVIA|Hisense|GoogleTV|CrKey|Viera|AppleTV|SamsungBrowser.*TV|Maple|HbbTV/i.test(
      ua
    )
  ) {
    return true;
  }
  if (typeof (window as any).tizen !== 'undefined' || typeof (window as any).webapis !== 'undefined') {
    return true;
  }
  return false;
}

export function toggleFullScreen(): void {
  if (typeof window === 'undefined') return;
  const doc = window.document as any;
  const docEl = doc.documentElement as any;

  const requestFullScreen =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;

  const cancelFullScreen =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  if (
    !doc.fullscreenElement &&
    !doc.webkitFullscreenElement &&
    !doc.mozFullScreenElement &&
    !doc.msFullscreenElement
  ) {
    if (requestFullScreen) {
      try {
        const res = requestFullScreen.call(docEl);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (e) {
        console.warn('[Fullscreen] requestFullScreen error:', e);
      }
    }
  } else {
    if (cancelFullScreen) {
      try {
        const res = cancelFullScreen.call(doc);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (e) {
        console.warn('[Fullscreen] cancelFullScreen error:', e);
      }
    }
  }
}

export function isFullScreenActive(): boolean {
  if (typeof window === 'undefined') return false;
  const doc = window.document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function addFullScreenChangeListener(callback: (isFull: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    callback(isFullScreenActive());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}

/**
 * Explicitly enter fullscreen mode with WebKit vendor prefix support (Tizen Samsung TV, LG webOS, etc.)
 */
export function enterFullScreen(targetEl?: Element): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const doc = window.document as any;
  const elementsToTry = [targetEl, doc.documentElement, doc.body, doc.getElementById('root')].filter(Boolean);

  for (const el of elementsToTry) {
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (fn) {
      try {
        const res = fn.call(el);
        if (res && typeof res.then === 'function') {
          return res.then(() => true).catch(() => false);
        }
        return Promise.resolve(true);
      } catch (e) {
        // Continue to next candidate
      }
    }
  }
  return Promise.resolve(false);
}

/**
 * Explicitly exit fullscreen mode with WebKit vendor prefix support
 */
export function exitFullScreen(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const doc = window.document as any;
  const cancelFullScreen =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  if (cancelFullScreen) {
    try {
      const res = cancelFullScreen.call(doc);
      if (res && typeof res.then === 'function') {
        return res.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    } catch (e) {
      console.warn('[Fullscreen] exitFullScreen error:', e);
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}

// Global reference for Screen Wake Lock sentinel
let wakeLockSentinel: any = null;

/**
 * Screen Wake Lock API to prevent Smart TV screens from sleeping or dimming during karaoke
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if ('wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      if (wakeLockSentinel) {
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
      return true;
    } catch (err) {
      console.warn('[WakeLock] Unable to acquire screen wake lock:', err);
      return false;
    }
  }
  return false;
}

export function releaseScreenWakeLock(): void {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {}
    wakeLockSentinel = null;
  }
}

/**
 * Automatic Fullscreen Trigger for Samsung Smart TV (Tizen OS) and Big Screen Displays.
 * Calls fullscreen immediately on mount without requiring any button clicks, with multi-stage
 * retries to handle Tizen WebKit readiness, plus transparent one-touch listeners on any user input.
 */
export function autoTriggerSmartTvFullscreen(targetEl?: Element): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Register Tizen remote media keys if available
  if (typeof (window as any).tizen !== 'undefined' && (window as any).tizen.tvinputdevice) {
    try {
      const tid = (window as any).tizen.tvinputdevice;
      const tizenKeys = [
        'MediaPlay',
        'MediaPause',
        'MediaPlayPause',
        'MediaStop',
        'MediaFastForward',
        'MediaRewind',
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'ColorF0Red',
        'ColorF1Green',
        'ColorF2Yellow',
        'ColorF3Blue',
      ];
      tizenKeys.forEach((keyName) => {
        try {
          tid.registerKey(keyName);
        } catch (_) {}
      });
    } catch (_) {}
  }

  // 2. Immediate programmatic fullscreen attempt
  enterFullScreen(targetEl);
  requestScreenWakeLock();

  // 3. Staggered retries to guarantee fullscreen once the TV browser viewport has rendered
  const timers = [
    setTimeout(() => {
      if (!isFullScreenActive()) enterFullScreen(targetEl);
    }, 100),
    setTimeout(() => {
      if (!isFullScreenActive()) enterFullScreen(targetEl);
      requestScreenWakeLock();
    }, 350),
    setTimeout(() => {
      if (!isFullScreenActive()) enterFullScreen(targetEl);
    }, 800),
    setTimeout(() => {
      if (!isFullScreenActive()) enterFullScreen(targetEl);
    }, 1500),
  ];

  // 4. Transparent fallback: on the very first TV remote button press or interaction,
  // ensure the TV is in fullscreen invisibly without any popup or modal.
  const handleAnyInteraction = () => {
    if (!isFullScreenActive()) {
      enterFullScreen(targetEl);
    }
    requestScreenWakeLock();
  };

  const events = ['keydown', 'pointerdown', 'touchstart', 'click'];
  events.forEach((evt) => {
    window.addEventListener(evt, handleAnyInteraction, { capture: true, passive: true });
    document.addEventListener(evt, handleAnyInteraction, { capture: true, passive: true });
  });

  return () => {
    timers.forEach((t) => clearTimeout(t));
    events.forEach((evt) => {
      window.removeEventListener(evt, handleAnyInteraction, { capture: true } as any);
      document.removeEventListener(evt, handleAnyInteraction, { capture: true } as any);
    });
  };
}

// Bind to window for TV remotes and global event handling
if (typeof window !== 'undefined') {
  (window as any).toggleFullScreen = toggleFullScreen;
  (window as any).enterFullScreen = enterFullScreen;
  (window as any).requestScreenWakeLock = requestScreenWakeLock;
  (window as any).isSamsungSmartTv = isSamsungSmartTv;
  (window as any).isSmartTvDevice = isSmartTvDevice;
  (window as any).autoTriggerSmartTvFullscreen = autoTriggerSmartTvFullscreen;
}
