const i18n = (() => {
  const fallbackLocale = "en";
  const remoteLocalesBaseUrl = "https://raw.githubusercontent.com/diorhc/TGP/main/locales";
  const localeCachePrefix = "tel_i18n_cache_v1_";
  const localeCacheTtlMs = 7 * 24 * 60 * 60 * 1000;
  const localeLabels = {
    auto: "Auto",
    ar: "العربية",
    az: "Azərbaycanca",
    be: "Беларуская",
    bg: "Български",
    cn: "简体中文",
    de: "Deutsch",
    du: "Nederlands",
    en: "English",
    es: "Español",
    fr: "Français",
    hi: "हिन्दी",
    id: "Bahasa Indonesia",
    it: "Italiano",
    jp: "日本語",
    kk: "Қазақша",
    kr: "한국어",
    ky: "Кыргызча",
    pl: "Polski",
    pt: "Português",
    ru: "Русский",
    tr: "Türkçe",
    tw: "繁體中文",
    uk: "Українська",
    uz: "Oʻzbekcha",
    vi: "Tiếng Việt",
  };
  const supportedLocaleCodes = Object.keys(localeLabels).filter((code) => code !== "auto");
  const knownLocales = supportedLocaleCodes.reduce((acc, code) => {
    acc[code] = {};
    return acc;
  }, {});

  const aliasMap = DEFAULT_LOCALE_ALIAS_MAP;

  const dictionary = {
    ...knownLocales,
  };
  const loadedLocales = new Set(
    Object.entries(dictionary)
      .filter(([, value]) => isPlainObject(value) && Object.keys(value).length > 0)
      .map(([code]) => code),
  );
  const inFlightLocaleLoads = new Map();

  const canUseStorage = () => {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  };

  const readLocaleCache = (code) => {
    if (!canUseStorage()) return null;
    const cacheKey = `${localeCachePrefix}${code}`;
    const cached = safeJsonParse(localStorage.getItem(cacheKey), null);
    if (!isPlainObject(cached)) return null;
    if (!isPlainObject(cached.data)) return null;
    if (Date.now() - Number(cached.updatedAt || 0) > localeCacheTtlMs) return null;
    return cached.data;
  };

  const writeLocaleCache = (code, data) => {
    if (!canUseStorage() || !isPlainObject(data)) return;
    const cacheKey = `${localeCachePrefix}${code}`;
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          updatedAt: Date.now(),
          data,
        }),
      );
    } catch {}
  };

  const mergeLocaleDictionary = (code, data) => {
    if (!isPlainObject(data)) return false;
    dictionary[code] = {
      ...(isPlainObject(dictionary[code]) ? dictionary[code] : {}),
      ...data,
    };
    loadedLocales.add(code);
    return true;
  };

  const fetchLocaleFromGithub = async (code) => {
    const response = await fetch(`${remoteLocalesBaseUrl}/${encodeURIComponent(code)}.json`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!isPlainObject(payload)) {
      throw new Error("Locale payload is not an object");
    }
    return payload;
  };

  const loadLocaleDictionary = async (code, { forceRemote = false } = {}) => {
    const normalizedCode = String(code || "").toLowerCase();
    if (!knownLocales[normalizedCode]) return false;
    if (!forceRemote && loadedLocales.has(normalizedCode)) return true;

    const existingRequest = inFlightLocaleLoads.get(normalizedCode);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      try {
        if (!forceRemote) {
          const cached = readLocaleCache(normalizedCode);
          if (cached && mergeLocaleDictionary(normalizedCode, cached)) {
            return true;
          }
        }

        const remoteData = await fetchLocaleFromGithub(normalizedCode);
        const merged = mergeLocaleDictionary(normalizedCode, remoteData);
        if (merged) writeLocaleCache(normalizedCode, remoteData);
        return merged;
      } catch (error) {
        if (typeof logger !== "undefined") {
          logger.warn(`[i18n] failed to load '${normalizedCode}' from GitHub: ${error.message}`);
        }
        return false;
      } finally {
        inFlightLocaleLoads.delete(normalizedCode);
      }
    })();

    inFlightLocaleLoads.set(normalizedCode, request);
    return request;
  };

  let locale = fallbackLocale;
  let initPromise = null;

  const detectBrowserLocale = () =>
    detectBrowserLocaleCode({
      browserLocale: navigator.language || navigator.userLanguage,
      dictionary: knownLocales,
      aliasMap,
      fallbackLocale,
    });

  const normalizeLocale = (value) =>
    normalizeLocaleCode({
      requestedLocale: value,
      browserLocale: navigator.language || navigator.userLanguage,
      dictionary: knownLocales,
      aliasMap,
      fallbackLocale,
    });

  const ensureLocaleLoaded = async (targetLocale) => {
    await loadLocaleDictionary(fallbackLocale);
    if (targetLocale !== fallbackLocale) {
      await loadLocaleDictionary(targetLocale);
    }
  };

  const init = () => {
    if (initPromise) return initPromise;
    initPromise = ensureLocaleLoaded(locale).then(() => locale);
    return initPromise;
  };

  const setLocale = (nextLocale) => {
    locale = normalizeLocale(nextLocale);
    void ensureLocaleLoaded(locale);
    if (isDevMode()) {
      validateLocale(locale);
    }
    return locale;
  };

  const getLocale = () => locale;

  const t = (key, fallback = "") => {
    return translateDictionaryKey({
      dictionary,
      locale,
      key,
      fallback,
      fallbackLocale,
    });
  };

  const getLanguageOptions = () => {
    const codes = ["auto", ...supportedLocaleCodes.slice().sort()];
    return codes.map((code) => ({
      value: code,
      label: localeLabels[code] || code,
    }));
  };

  const isDevMode = () => {
    try {
      return localStorage.getItem("tel_devmode") === "1";
    } catch {
      return false;
    }
  };

  const validateLocale = (targetLocale) => {
    const base = dictionary[fallbackLocale];
    const current = dictionary[targetLocale];
    if (!base || !current || typeof logger === "undefined") return;

    const baseKeys = Object.keys(base);
    const missingKeys = baseKeys.filter((key) => !(key in current));
    const extraKeys = Object.keys(current).filter((key) => !(key in base));

    if (missingKeys.length > 0) {
      logger.warn(`[i18n] Locale '${targetLocale}' is missing keys: ${missingKeys.join(", ")}`);
    }
    if (extraKeys.length > 0) {
      logger.warn(`[i18n] Locale '${targetLocale}' has extra keys: ${extraKeys.join(", ")}`);
    }
  };

  setLocale(state.settings.uiLanguage);
  void init();

  return {
    getLocale,
    setLocale,
    t,
    getLanguageOptions,
    validateLocale,
    init,
    reloadLocale: (code) => loadLocaleDictionary(normalizeLocale(code), { forceRemote: true }),
  };
})();
