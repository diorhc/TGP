"use strict";

const {
  hashCode,
  safeJsonParse,
  isPlainObject,
  normalizeSettings,
  DEFAULT_SETTINGS,
  extractFileName,
  getExtensionFromMime,
  isValidMimeType,
  shouldRetryDownloadError,
  getRetryDelayMs,
  getRetryPlan,
  getCancelPlan,
  canManualRetry,
  getQueueSlots,
  planPendingSelection,
  getQueueActivationIndexes,
  DEFAULT_LOCALE_ALIAS_MAP,
  detectBrowserLocaleCode,
  normalizeLocaleCode,
  translateDictionaryKey,
} = require("../src/pure.js");

describe("safeJsonParse", () => {
  test("returns fallback for invalid JSON", () => {
    expect(safeJsonParse("{bad-json", { ok: true })).toEqual({ ok: true });
  });

  test("strips dangerous prototype keys during parse", () => {
    const value = safeJsonParse('{"ok":1,"__proto__":{"polluted":true}}', null);
    expect(value).toEqual({ ok: 1 });
    expect({}.polluted).toBe(undefined);
  });
});

describe("isPlainObject", () => {
  test("accepts plain objects and null-prototype objects", () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  test("rejects arrays, primitives and class instances", () => {
    class Sample {}
    expect(isPlainObject([1, 2])).toBe(false);
    expect(isPlainObject("x")).toBe(false);
    expect(isPlainObject(new Sample())).toBe(false);
  });
});

describe("hashCode", () => {
  test("returns the same value for the same input", () => {
    expect(hashCode("foo")).toBe(hashCode("foo"));
  });
  test("returns different values for different inputs", () => {
    expect(hashCode("foo")).not.toBe(hashCode("bar"));
  });
  test("returns an unsigned 32-bit integer", () => {
    const value = hashCode("https://example.com/path?q=1");
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("normalizeSettings", () => {
  test("fills in defaults from an empty object", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });
  test("coerces non-boolean truthy values to booleans", () => {
    const result = normalizeSettings({ enableNotifications: 0 });
    expect(result.enableNotifications).toBe(false);
  });
  test("normalizes experimental stream capture flag", () => {
    expect(
      normalizeSettings({ enableExperimentalStreamCapture: 1 }).enableExperimentalStreamCapture,
    ).toBe(true);
    expect(
      normalizeSettings({ enableExperimentalStreamCapture: 0 }).enableExperimentalStreamCapture,
    ).toBe(false);
  });
  test("accepts valid downloadLocation values", () => {
    for (const location of ["browser", "picker", "tab", "auto"]) {
      expect(normalizeSettings({ downloadLocation: location }).downloadLocation).toBe(location);
    }
  });
  test("rejects unknown downloadLocation values", () => {
    expect(normalizeSettings({ downloadLocation: "ftp" }).downloadLocation).toBe("browser");
  });
  test("accepts valid uiLanguage values", () => {
    expect(normalizeSettings({ uiLanguage: "ru" }).uiLanguage).toBe("ru");
    expect(normalizeSettings({ uiLanguage: "AUTO" }).uiLanguage).toBe("auto");
  });
  test("rejects unknown uiLanguage values", () => {
    expect(normalizeSettings({ uiLanguage: "xx" }).uiLanguage).toBe("auto");
  });
});

describe("getExtensionFromMime", () => {
  test("maps known mimes", () => {
    expect(getExtensionFromMime("video/mp4")).toBe("mp4");
    expect(getExtensionFromMime("audio/mpeg")).toBe("mp3");
    expect(getExtensionFromMime("image/jpeg")).toBe("jpg");
  });
  test("ignores parameters after `;`", () => {
    expect(getExtensionFromMime("video/mp4; codecs=avc1.42E01E")).toBe("mp4");
  });
  test("falls back to defaultExt", () => {
    expect(getExtensionFromMime("", "bin")).toBe("bin");
    expect(getExtensionFromMime(null, "dat")).toBe("dat");
  });
});

describe("isValidMimeType", () => {
  test("accepts known mime in known category", () => {
    expect(isValidMimeType("video/mp4", "video")).toBe(true);
  });
  test("accepts category prefix even for unknown mime", () => {
    expect(isValidMimeType("video/exotic-codec", "video")).toBe(true);
  });
  test("rejects mismatched categories", () => {
    expect(isValidMimeType("audio/mpeg", "video")).toBe(false);
  });
});

describe("extractFileName", () => {
  test("returns the last path segment when it has an extension", () => {
    expect(extractFileName("https://example.com/path/file.mp4")).toBe("file.mp4");
  });
  test("appends the default extension when the URL has no filename", () => {
    const name = extractFileName("https://example.com/stream/abc", "mp4");
    expect(name).toMatch(/\.mp4$/);
    expect(name.startsWith("telegram_")).toBe(true);
  });
  test("uses JSON metadata when the last segment is encoded", () => {
    const meta = encodeURIComponent(JSON.stringify({ fileName: "video.mov" }));
    expect(extractFileName(`https://example.com/stream/${meta}`)).toBe("video.mov");
  });

  test("returns decoded unicode filename from URL path", () => {
    const encoded = "%D1%84%D0%B0%D0%B9%D0%BB.mp4";
    expect(extractFileName(`https://example.com/path/${encoded}`)).toBe("файл.mp4");
  });

  test("keeps undecodable filename segment without throwing", () => {
    expect(extractFileName("https://example.com/path/%E0%A4%A.mp4")).toBe("%E0%A4%A.mp4");
  });
});

describe("shouldRetryDownloadError", () => {
  test("retries on transient network TypeError", () => {
    expect(shouldRetryDownloadError(new TypeError("Failed to fetch"))).toBe(true);
  });

  test("retries on 429 and 5xx response errors", () => {
    expect(shouldRetryDownloadError(new Error("Unexpected response: 429"))).toBe(true);
    expect(shouldRetryDownloadError(new Error("Unexpected response: 503"))).toBe(true);
  });

  test("does not retry on abort and data-integrity errors", () => {
    expect(
      shouldRetryDownloadError(Object.assign(new Error("aborted"), { name: "AbortError" })),
    ).toBe(false);
    expect(shouldRetryDownloadError(new Error("Chunk offset mismatch"))).toBe(false);
    expect(shouldRetryDownloadError(new Error("Unexpected MIME type: text/html"))).toBe(false);
  });

  test("retries on explicit NetworkError names", () => {
    expect(
      shouldRetryDownloadError({
        name: "NetworkError",
        message: "connection dropped",
      }),
    ).toBe(true);
  });
});

describe("getRetryDelayMs", () => {
  test("uses exponential backoff from base delay", () => {
    expect(getRetryDelayMs(1, 1000)).toBe(1000);
    expect(getRetryDelayMs(2, 1000)).toBe(2000);
    expect(getRetryDelayMs(3, 1000)).toBe(4000);
  });

  test("caps delay by maxDelay", () => {
    expect(getRetryDelayMs(10, 1000, 5000)).toBe(5000);
  });

  test("normalizes invalid inputs", () => {
    expect(getRetryDelayMs(0, 1000)).toBe(1000);
    expect(getRetryDelayMs(NaN, 1000)).toBe(1000);
    expect(getRetryDelayMs(2, -100)).toBe(0);
  });
});

describe("getRetryPlan", () => {
  test("returns retry action with incremented counter and delay", () => {
    const plan = getRetryPlan({
      retryCount: 0,
      error: new TypeError("Failed to fetch"),
      maxRetries: 3,
      baseDelay: 1000,
    });

    expect(plan).toEqual({ action: "retry", retryCount: 1, delay: 1000 });
  });

  test("returns fail action when max retries exceeded", () => {
    const plan = getRetryPlan({
      retryCount: 3,
      error: new TypeError("Failed to fetch"),
      maxRetries: 3,
      baseDelay: 1000,
    });

    expect(plan).toEqual({ action: "fail", retryCount: 4, delay: 0 });
  });

  test("returns fail action for non-retryable errors", () => {
    const plan = getRetryPlan({
      retryCount: 1,
      error: new Error("Unexpected MIME type: text/html"),
      maxRetries: 3,
      baseDelay: 1000,
    });

    expect(plan).toEqual({ action: "fail", retryCount: 2, delay: 0 });
  });

  test("normalizes invalid retryCount and retries from attempt one", () => {
    const plan = getRetryPlan({
      retryCount: Number.NaN,
      error: new TypeError("Network unstable"),
      maxRetries: 2,
      baseDelay: 500,
    });

    expect(plan).toEqual({ action: "retry", retryCount: 1, delay: 500 });
  });
});

describe("getCancelPlan", () => {
  test("removes task from pending queue when present", () => {
    expect(getCancelPlan({ inPendingQueue: true, hasAbortController: true })).toBe(
      "remove-pending",
    );
  });

  test("aborts active task when not pending and abort controller exists", () => {
    expect(getCancelPlan({ inPendingQueue: false, hasAbortController: true })).toBe("abort-active");
  });

  test("returns noop when neither pending nor active", () => {
    expect(getCancelPlan({ inPendingQueue: false, hasAbortController: false })).toBe("noop");
  });
});

describe("canManualRetry", () => {
  test("blocks retry for queued, active and retrying statuses", () => {
    expect(canManualRetry("queued")).toBe(false);
    expect(canManualRetry("active")).toBe(false);
    expect(canManualRetry("retrying")).toBe(false);
  });

  test("allows retry for terminal statuses", () => {
    expect(canManualRetry("failed")).toBe(true);
    expect(canManualRetry("aborted")).toBe(true);
    expect(canManualRetry("completed")).toBe(true);
  });
});

describe("getQueueSlots", () => {
  test("returns remaining slots based on active and max", () => {
    expect(getQueueSlots(0, 2)).toBe(2);
    expect(getQueueSlots(1, 2)).toBe(1);
    expect(getQueueSlots(2, 2)).toBe(0);
  });

  test("normalizes invalid values", () => {
    expect(getQueueSlots(-1, 2)).toBe(2);
    expect(getQueueSlots(1, -2)).toBe(0);
    expect(getQueueSlots(NaN, NaN)).toBe(0);
  });

  test("never returns negative slots when active exceeds max", () => {
    expect(getQueueSlots(5, 2)).toBe(0);
  });
});

describe("planPendingSelection", () => {
  test("selects first queued indexes up to available slots", () => {
    const indexes = planPendingSelection(["queued", "retrying", "queued", "queued"], 2);
    expect(indexes).toEqual([0, 2]);
  });

  test("returns empty for zero slots or invalid input", () => {
    expect(planPendingSelection(["queued"], 0)).toEqual([]);
    expect(planPendingSelection(null, 2)).toEqual([]);
  });

  test("skips non-queued statuses and preserves order", () => {
    const indexes = planPendingSelection(["active", "queued", "aborted", "queued"], 5);
    expect(indexes).toEqual([1, 3]);
  });

  test("takes up to floored slot count", () => {
    const indexes = planPendingSelection(["queued", "queued", "queued"], 1.9);
    expect(indexes).toEqual([0]);
  });
});

describe("getQueueActivationIndexes", () => {
  test("derives slots from active count and max limit", () => {
    const indexes = getQueueActivationIndexes({
      pendingStatuses: ["queued", "queued", "active"],
      activeCount: 1,
      maxActive: 2,
    });
    expect(indexes).toEqual([0]);
  });

  test("returns empty when there are no free slots", () => {
    const indexes = getQueueActivationIndexes({
      pendingStatuses: ["queued", "queued"],
      activeCount: 2,
      maxActive: 2,
    });
    expect(indexes).toEqual([]);
  });

  test("handles invalid input object safely", () => {
    expect(getQueueActivationIndexes()).toEqual([]);
    expect(
      getQueueActivationIndexes({ pendingStatuses: "queued", activeCount: 0, maxActive: 2 }),
    ).toEqual([]);
  });
});

describe("i18n pure helpers", () => {
  const dictionary = {
    en: { hello: "Hello", common: "Common" },
    ru: { hello: "Privet" },
    kr: { hello: "Annyeong" },
    du: { hello: "Hallo" },
    tw: { hello: "Nihao TW" },
  };

  test("detectBrowserLocaleCode maps aliases and falls back", () => {
    expect(
      detectBrowserLocaleCode({
        browserLocale: "ko-KR",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("kr");

    expect(
      detectBrowserLocaleCode({
        browserLocale: "xx-YY",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("en");
  });

  test("normalizeLocaleCode supports auto, aliases and unknown values", () => {
    expect(
      normalizeLocaleCode({
        requestedLocale: "auto",
        browserLocale: "zh-HK",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("tw");

    expect(
      normalizeLocaleCode({
        requestedLocale: "nl",
        browserLocale: "en-US",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("du");

    expect(
      normalizeLocaleCode({
        requestedLocale: "xx",
        browserLocale: "en-US",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("en");

    expect(
      normalizeLocaleCode({
        requestedLocale: "ko",
        browserLocale: "en-US",
        dictionary,
        aliasMap: DEFAULT_LOCALE_ALIAS_MAP,
        fallbackLocale: "en",
      }),
    ).toBe("kr");
  });

  test("translateDictionaryKey falls back to english and explicit fallback", () => {
    expect(
      translateDictionaryKey({
        dictionary,
        locale: "ru",
        key: "hello",
        fallback: "-",
        fallbackLocale: "en",
      }),
    ).toBe("Privet");

    expect(
      translateDictionaryKey({
        dictionary,
        locale: "ru",
        key: "common",
        fallback: "-",
        fallbackLocale: "en",
      }),
    ).toBe("Common");

    expect(
      translateDictionaryKey({
        dictionary,
        locale: "ru",
        key: "missing",
        fallback: "Fallback",
        fallbackLocale: "en",
      }),
    ).toBe("Fallback");
  });

  test("returns explicit fallback for empty keys", () => {
    expect(
      translateDictionaryKey({
        dictionary,
        locale: "en",
        key: "",
        fallback: "N/A",
        fallbackLocale: "en",
      }),
    ).toBe("N/A");
  });
});
