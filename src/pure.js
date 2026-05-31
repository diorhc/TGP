// ───────────────────────────────────────────────────────────────────────────
// Pure, side-effect-free helpers. No DOM or window access.
// Concatenated into the userscript bundle AND re-exported via CommonJS for
// Node-based unit tests in test/.
// ───────────────────────────────────────────────────────────────────────────

const hashCode = (text) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
};

const DANGEROUS_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const safeJsonReviver = (key, value) => {
  if (DANGEROUS_JSON_KEYS.has(key)) return undefined;
  return value;
};

const safeJsonParse = (raw, fallback = null) => {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw, safeJsonReviver);
  } catch {
    return fallback;
  }
};

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const SUPPORTED_MIMES = {
  video: {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/mpeg": "mpeg",
    "video/x-msvideo": "avi",
  },
  audio: {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/webm": "weba",
    "audio/aac": "aac",
    "audio/flac": "flac",
  },
  image: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
  },
};

const DEFAULT_SETTINGS = {
  enableNotifications: true,
  enableKeyboardShortcuts: true,
  // Conservative default: ad blocking can interfere with Telegram's virtual DOM updates.
  enableAdBlocking: false,
  enableExperimentalStreamCapture: false,
  autoDownloadQuality: "original",
  downloadLocation: "browser",
  uiLanguage: "auto",
};

const ALLOWED_DOWNLOAD_LOCATIONS = new Set(["browser", "picker", "tab", "auto"]);
const ALLOWED_UI_LANGUAGES = new Set([
  "auto",
  "ar",
  "az",
  "be",
  "bg",
  "cn",
  "de",
  "du",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "jp",
  "kk",
  "kr",
  "ky",
  "pl",
  "pt",
  "ru",
  "tr",
  "tw",
  "uk",
  "uz",
  "vi",
]);

const DEFAULT_LOCALE_ALIAS_MAP = {
  ko: "kr",
  ja: "jp",
  zh: "cn",
  "zh-cn": "cn",
  "zh-sg": "cn",
  "zh-tw": "tw",
  "zh-hk": "tw",
  nl: "du",
};

const normalizeSettings = (rawSettings = {}) => {
  const candidate = { ...DEFAULT_SETTINGS, ...rawSettings };
  return {
    ...candidate,
    enableNotifications: Boolean(candidate.enableNotifications),
    enableKeyboardShortcuts: Boolean(candidate.enableKeyboardShortcuts),
    enableAdBlocking: Boolean(candidate.enableAdBlocking),
    enableExperimentalStreamCapture: Boolean(candidate.enableExperimentalStreamCapture),
    downloadLocation: ALLOWED_DOWNLOAD_LOCATIONS.has(candidate.downloadLocation)
      ? candidate.downloadLocation
      : DEFAULT_SETTINGS.downloadLocation,
    uiLanguage: ALLOWED_UI_LANGUAGES.has(String(candidate.uiLanguage || "").toLowerCase())
      ? String(candidate.uiLanguage).toLowerCase()
      : DEFAULT_SETTINGS.uiLanguage,
  };
};

const getExtensionFromMime = (mimeType, defaultExt = "bin") => {
  const mime = String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  for (const category of Object.values(SUPPORTED_MIMES)) {
    if (category[mime]) return category[mime];
  }
  const parts = mime.split("/");
  if (parts.length === 2 && parts[1]) {
    return parts[1].replace(/^x-/, "");
  }
  return defaultExt;
};

const isValidMimeType = (mimeType, category) => {
  const mime = String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (SUPPORTED_MIMES[category] && SUPPORTED_MIMES[category][mime]) {
    return true;
  }
  return mime.startsWith(`${category}/`);
};

const extractFileName = (url, defaultExt = "mp4") => {
  try {
    const metadata = JSON.parse(decodeURIComponent(url.split("/").pop()));
    if (metadata.fileName) return metadata.fileName;
  } catch {}

  try {
    const urlObj = new URL(url);
    const lastPart = urlObj.pathname.split("/").pop();
    if (lastPart && lastPart.includes(".")) {
      try {
        return decodeURIComponent(lastPart);
      } catch {
        return lastPart;
      }
    }
  } catch {}

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  return `telegram_${timestamp}_${hashCode(url).toString(36)}.${defaultExt}`;
};

const shouldRetryDownloadError = (error) => {
  if (!error) return false;
  const name = String(error.name || "");
  const message = String(error.message || "").toLowerCase();

  if (name === "AbortError") return false;

  if (name === "TypeError") {
    return (
      message.includes("failed to fetch") ||
      message.includes("load failed") ||
      message.includes("network")
    );
  }

  if (name === "NetworkError") return true;

  if (message.includes("unexpected response: 429")) return true;
  if (/unexpected response: 5\d\d/.test(message)) return true;

  return false;
};

const getRetryDelayMs = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  const normalizedBase = Number.isFinite(baseDelay) ? Math.max(0, baseDelay) : 1000;
  const normalizedMax = Number.isFinite(maxDelay) ? Math.max(0, maxDelay) : 30000;
  const delay = normalizedBase * Math.pow(2, normalizedAttempt - 1);
  return Math.min(delay, normalizedMax);
};

const getRetryPlan = ({
  retryCount,
  error,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 30000,
} = {}) => {
  const nextRetryCount = (Number.isFinite(retryCount) ? retryCount : 0) + 1;
  const normalizedMaxRetries = Number.isFinite(maxRetries) ? Math.max(0, maxRetries) : 3;

  const retryable = shouldRetryDownloadError(error);
  if (!retryable || nextRetryCount > normalizedMaxRetries) {
    return {
      action: "fail",
      retryCount: nextRetryCount,
      delay: 0,
    };
  }

  return {
    action: "retry",
    retryCount: nextRetryCount,
    delay: getRetryDelayMs(nextRetryCount, baseDelay, maxDelay),
  };
};

const getCancelPlan = ({ inPendingQueue = false, hasAbortController = false } = {}) => {
  if (inPendingQueue) return "remove-pending";
  if (hasAbortController) return "abort-active";
  return "noop";
};

const canManualRetry = (status) => !["queued", "active", "retrying"].includes(status);

const getQueueSlots = (activeCount, maxActive = 2) => {
  const current = Number.isFinite(activeCount) ? Math.max(0, activeCount) : 0;
  const limit = Number.isFinite(maxActive) ? Math.max(0, maxActive) : 0;
  return Math.max(0, limit - current);
};

const planPendingSelection = (pendingStatuses, slots) => {
  const selectedIndexes = [];
  const maxToTake = Number.isFinite(slots) ? Math.max(0, Math.floor(slots)) : 0;
  if (!Array.isArray(pendingStatuses) || maxToTake === 0) return selectedIndexes;

  for (let index = 0; index < pendingStatuses.length; index += 1) {
    if (selectedIndexes.length >= maxToTake) break;
    if (pendingStatuses[index] === "queued") selectedIndexes.push(index);
  }

  return selectedIndexes;
};

const getQueueActivationIndexes = ({ pendingStatuses, activeCount, maxActive = 2 } = {}) => {
  const slots = getQueueSlots(activeCount, maxActive);
  if (slots === 0) return [];
  return planPendingSelection(pendingStatuses, slots);
};

const detectBrowserLocaleCode = ({
  browserLocale,
  dictionary,
  aliasMap = DEFAULT_LOCALE_ALIAS_MAP,
  fallbackLocale = "en",
} = {}) => {
  const raw = String(browserLocale || "").toLowerCase();
  const exact = aliasMap[raw];
  if (exact) return exact;
  const base = raw.split(/[-_]/)[0];
  return aliasMap[base] || (dictionary?.[base] ? base : fallbackLocale);
};

const normalizeLocaleCode = ({
  requestedLocale,
  browserLocale,
  dictionary,
  aliasMap = DEFAULT_LOCALE_ALIAS_MAP,
  fallbackLocale = "en",
} = {}) => {
  const requested = String(requestedLocale || "").toLowerCase();
  if (!requested || requested === "auto") {
    return detectBrowserLocaleCode({
      browserLocale,
      dictionary,
      aliasMap,
      fallbackLocale,
    });
  }

  const mapped = aliasMap[requested] || requested;
  if (dictionary?.[mapped]) return mapped;
  const base = mapped.split(/[-_]/)[0];
  return dictionary?.[base] ? base : fallbackLocale;
};

const translateDictionaryKey = ({
  dictionary,
  locale,
  key,
  fallback = "",
  fallbackLocale = "en",
} = {}) => {
  if (!key) return fallback;
  return dictionary?.[locale]?.[key] ?? dictionary?.[fallbackLocale]?.[key] ?? fallback;
};

// CommonJS export for Node test runners. The guard ensures the userscript
// bundle (which has no `module` global) ignores this block at runtime.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    hashCode,
    safeJsonParse,
    isPlainObject,
    SUPPORTED_MIMES,
    DEFAULT_SETTINGS,
    ALLOWED_DOWNLOAD_LOCATIONS,
    ALLOWED_UI_LANGUAGES,
    DEFAULT_LOCALE_ALIAS_MAP,
    normalizeSettings,
    getExtensionFromMime,
    isValidMimeType,
    extractFileName,
    shouldRetryDownloadError,
    getRetryDelayMs,
    getRetryPlan,
    getCancelPlan,
    canManualRetry,
    getQueueSlots,
    planPendingSelection,
    getQueueActivationIndexes,
    detectBrowserLocaleCode,
    normalizeLocaleCode,
    translateDictionaryKey,
  };
}
