// NOTE: this file is the FIRST concatenation fragment of the userscript
// bundle (see build.order.json + scripts/build.js). The build step wraps the
// final bundle in an IIFE with a re-entry guard, so this file itself is now
// syntactically self-contained and only declares top-level constants used by
// the rest of the bundled fragments.
/* global safeJsonParse, isPlainObject */

const logger = {
  info: (message, file = "") => console.log(`[Tel Download]${file ? ` ${file}:` : ""} ${message}`),
  error: (message, file = "") =>
    console.error(`[Tel Download]${file ? ` ${file}:` : ""} ${message}`),
  warn: (message, file = "") => console.warn(`[Tel Download]${file ? ` ${file}:` : ""} ${message}`),
};

const DOWNLOAD_ICON = "\ue979";
const FORWARD_ICON = "\ue99a";
const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
const REFRESH_DELAY = 500;
const MAX_NOTIFICATIONS = 5;
const MAX_ACTIVE_DOWNLOADS = 2;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const EAGER_DOWNLOAD_LIMIT = 25 * 1024 * 1024;
const SETTINGS_KEY = "tel_downloader_settings";
const SETTINGS_SCHEMA_VERSION = 2;
const PROGRESS_KEY = "tg_video_progress";
const PROGRESS_CONTAINER_ID = "tel-downloader-progress-bar-container";
const TELEGRAM_SELECTORS = Object.freeze({
  webKMediaViewer: ".media-viewer-whole",
  webZMediaViewerRoot: "#MediaViewer",
  webZActiveSlide: "#MediaViewer .MediaViewerSlide--active",
  webZActions: "#MediaViewer .MediaViewerActions",
  webZMessageMeta: "#MediaViewer .MessageMeta",
  webZProfileInfo: "#MediaViewer .ProfileInfo",
  storiesViewer: "#stories-viewer",
  storyViewer: "#StoryViewer",
});
const IS_SAFARI = (() => {
  const userAgent = navigator.userAgent;
  return (
    /Safari\//.test(userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|YaBrowser|SamsungBrowser/.test(userAgent)
  );
})();

// DEFAULT_SETTINGS, ALLOWED_DOWNLOAD_LOCATIONS, normalizeSettings,
// SUPPORTED_MIMES are declared in src/pure.js so they can be unit-tested in Node.

const storageAdapter = (() => {
  const memory = new Map();

  const getFromLocalStorage = (key) => {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const setToLocalStorage = (key, value) => {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const getFromGM = (key) => {
    try {
      if (typeof GM_getValue !== "function") return null;
      const value = GM_getValue(key, null);
      if (value === null || typeof value === "undefined") return null;
      return String(value);
    } catch {
      return null;
    }
  };

  const setToGM = (key, value) => {
    try {
      if (typeof GM_setValue !== "function") return false;
      GM_setValue(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const getFromMemory = (key) => (memory.has(key) ? memory.get(key) : null);
  const setToMemory = (key, value) => {
    memory.set(key, value);
    return true;
  };

  return {
    getItem(key) {
      const localValue = getFromLocalStorage(key);
      if (localValue !== null) return localValue;

      const gmValue = getFromGM(key);
      if (gmValue !== null) return gmValue;

      return getFromMemory(key);
    },
    setItem(key, value) {
      if (setToLocalStorage(key, value)) return "localStorage";
      if (setToGM(key, value)) return "gm";
      setToMemory(key, value);
      return "memory";
    },
    detectAvailable() {
      if (setToLocalStorage("__tel_probe__", "1")) {
        try {
          localStorage.removeItem("__tel_probe__");
        } catch {}
        return "localStorage";
      }
      if (typeof GM_getValue === "function" && typeof GM_setValue === "function") {
        return "gm";
      }
      return "memory";
    },
  };
})();

const storageCache = (() => {
  let _settings = null;
  let _progress = null;
  let _flushTimer = null;
  const _dirty = new Set();

  const flushNow = () => {
    if (_dirty.has("settings") && _settings !== null) {
      try {
        storageAdapter.setItem(SETTINGS_KEY, JSON.stringify(_settings));
      } catch (e) {
        logger.error(`storageCache flush settings: ${e.message}`);
        return;
      }
      _dirty.delete("settings");
    }
    if (_dirty.has("progress") && _progress !== null) {
      try {
        storageAdapter.setItem(PROGRESS_KEY, JSON.stringify(_progress));
      } catch (e) {
        logger.error(`storageCache flush progress: ${e.message}`);
        return;
      }
      _dirty.delete("progress");
    }
    _flushTimer = null;
  };

  const scheduleFlush = () => {
    if (_flushTimer) return;
    _flushTimer = setTimeout(flushNow, 2000);
  };

  window.addEventListener("beforeunload", flushNow);

  return {
    getSettings() {
      if (_settings !== null) return _settings;
      try {
        const raw = storageAdapter.getItem(SETTINGS_KEY);
        if (!raw) {
          _settings = { ...DEFAULT_SETTINGS, _schemaVersion: SETTINGS_SCHEMA_VERSION };
          return _settings;
        }

        const parsed = safeJsonParse(raw, null);
        if (!isPlainObject(parsed)) {
          _settings = { ...DEFAULT_SETTINGS, _schemaVersion: SETTINGS_SCHEMA_VERSION };
          return _settings;
        }
        const normalized = normalizeSettings(parsed);
        const previousSchema = Number(parsed?._schemaVersion || 0);

        // One-time migration for older settings that may keep intrusive ad blocking enabled.
        if (previousSchema < SETTINGS_SCHEMA_VERSION) {
          normalized.enableAdBlocking = false;
          normalized._schemaVersion = SETTINGS_SCHEMA_VERSION;
          storageAdapter.setItem(SETTINGS_KEY, JSON.stringify(normalized));
          logger.info("Settings migrated to safe defaults");
        }

        _settings = normalized;
      } catch {
        _settings = { ...DEFAULT_SETTINGS, _schemaVersion: SETTINGS_SCHEMA_VERSION };
      }
      return _settings;
    },
    setSettings(s) {
      _settings = normalizeSettings(s);
      _dirty.add("settings");
      scheduleFlush();
    },
    getProgress() {
      if (_progress !== null) return _progress;
      try {
        const raw = storageAdapter.getItem(PROGRESS_KEY);
        const parsed = raw ? safeJsonParse(raw, {}) : {};
        _progress = isPlainObject(parsed) ? parsed : {};
      } catch {
        _progress = {};
      }
      return _progress;
    },
    setProgress(p) {
      _progress = p;
      _dirty.add("progress");
      scheduleFlush();
    },
    flush: flushNow,
  };
})();

function loadSettings() {
  return storageCache.getSettings();
}

function saveSettings(settings) {
  storageCache.setSettings(settings);
  logger.info("Settings saved");
}

const state = {
  settings: loadSettings(),
  currentHref: location.href,
  activeVideoBindings: new Map(),
  themeIsDark:
    document.documentElement.classList.contains("night") ||
    document.documentElement.classList.contains("theme-dark"),
};

logger.info(`Storage backend detected: ${storageAdapter.detectAvailable()}`);
