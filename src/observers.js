// Mutation observers, theme sync, self-test, and initialization flow.
const observersModule = (() => {
  const adSelectors = [
    '[class*="Sponsored"]',
    '[class*="sponsored"]',
    '[class*="sponsor"]',
    '[class*="Promo"]',
    '[class*="promo"]',
    '[data-testid="sponsored-message"]',
    '[data-testid*="sponsored"]',
    '[data-testid*="sponsor"]',
    '[data-testid="ad-banner"]',
    '[data-testid*="ad-"]',
    '[data-sponsored="true"]',
    '[aria-label*="Sponsored"]',
    '[aria-label*="sponsored"]',
  ];
  const adLabelRegex = /\b(ad|sponsored)\b/i;
  const adCtaRegex = /\b(open website|learn more|visit site|install|shop now)\b/i;
  const adContainerSelector = [
    '[data-testid*="message"]',
    '[class*="Message"]',
    '[class*="message"]',
    "article",
    ".ListItem",
  ].join(",");
  const uiRootSelectors = [
    TELEGRAM_SELECTORS.webKMediaViewer,
    TELEGRAM_SELECTORS.webZMediaViewerRoot,
    TELEGRAM_SELECTORS.storiesViewer,
    TELEGRAM_SELECTORS.storyViewer,
    ".pinned-audio",
    "#MiddleColumn",
    "#column-center",
  ];
  const adRootSelectors = [
    "#LeftColumn",
    "#MiddleColumn",
    "#column-left",
    "#column-center",
    "#Main",
  ];
  const scopedObservers = {
    ui: new Map(),
    ads: new Map(),
  };

  const disconnectScopedObservers = (registry) => {
    registry.forEach((observer) => observer.disconnect());
    registry.clear();
  };

  const loadProgress = () => storageCache.getProgress();
  const saveProgress = (progress) => storageCache.setProgress(progress);

  let refreshAdCleanup = () => {};

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const isLikelyInternalHost = (hostname) => {
    const host = String(hostname || "").toLowerCase();
    if (!host) return true;
    if (host === location.hostname) return true;
    if (host === "t.me" || host.endsWith(".t.me")) return true;
    if (host === "telegram.me" || host.endsWith(".telegram.me")) return true;
    if (host === "telegram.org" || host.endsWith(".telegram.org")) return true;
    return false;
  };

  const isExternalLinkAnchor = (anchor) => {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    const href = String(anchor.getAttribute("href") || "").trim();
    if (!href || href.startsWith("javascript:")) return false;

    try {
      const parsed = new URL(href, location.href);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      return !isLikelyInternalHost(parsed.hostname);
    } catch {
      return false;
    }
  };

  const resolveAdContainer = (element) => {
    if (!(element instanceof Element)) return null;
    return element.closest(adContainerSelector) || element;
  };

  const looksLikeSponsoredCard = (element) => {
    if (!(element instanceof HTMLElement)) return false;

    const text = normalizeText(element.innerText || element.textContent || "").slice(0, 1600);
    if (!text || !adLabelRegex.test(text)) return false;
    if (adCtaRegex.test(text)) return true;

    return Array.from(element.querySelectorAll("a[href]")).some((anchor) =>
      isExternalLinkAnchor(anchor),
    );
  };

  const hideAdElement = (element) => {
    if (!(element instanceof HTMLElement)) return;
    if (element.dataset.telAdHidden === "1") return;

    element.dataset.telAdHidden = "1";
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("pointer-events", "none", "important");
    element.style.setProperty("height", "0", "important");
    element.style.setProperty("min-height", "0", "important");
    element.setAttribute("aria-hidden", "true");
  };

  const removeAds = (root = document) => {
    if (!state.settings.enableAdBlocking) return;
    try {
      adSelectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((element) => {
          const container = resolveAdContainer(element);
          if (container) hideAdElement(container);
        });
      });

      const heuristicRoots = [];
      if (root instanceof Element || root instanceof Document) {
        heuristicRoots.push(root);
      }

      heuristicRoots.forEach((scopeRoot) => {
        const externalAnchors = Array.from(scopeRoot.querySelectorAll("a[href]"));
        externalAnchors.forEach((anchor) => {
          if (!isExternalLinkAnchor(anchor)) return;
          const container = resolveAdContainer(anchor);
          if (!container || !looksLikeSponsoredCard(container)) return;
          hideAdElement(container);
        });
      });
    } catch (error) {
      logger.error(`Error removing ads: ${error.message}`);
    }
  };

  const syncVideoProgress = () => {
    const activeMedia = getActiveMediaContext();
    const video = activeMedia?.video;
    if (!video) return;
    const key = activeMedia.key;
    const store = loadProgress();
    if (store[key] && !video.dataset.telProgressRestored) {
      video.currentTime = store[key];
      video.dataset.telProgressRestored = "1";
    }
    if (video.dataset.telProgressBound === key) return;
    video.dataset.telProgressBound = key;

    state.activeVideoBindings.get(key)?.();

    let lastPersistedSecond = -1;
    const persistCurrentTime = () => {
      if (!Number.isFinite(video.currentTime) || video.ended) return;
      const roundedSecond = Math.floor(video.currentTime);
      if (roundedSecond === lastPersistedSecond) return;
      lastPersistedSecond = roundedSecond;
      const nextStore = loadProgress();
      nextStore[key] = video.currentTime;
      saveProgress(nextStore);
    };
    const handleTimeUpdate = () => {
      if (video.paused || video.ended) return;
      const roundedSecond = Math.floor(video.currentTime);
      if (roundedSecond % 2 !== 0) return;
      persistCurrentTime();
    };
    const handlePause = () => {
      persistCurrentTime();
    };
    const handleEnded = () => {
      cleanup();
      const nextStore = loadProgress();
      delete nextStore[key];
      saveProgress(nextStore);
    };
    const cleanup = () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      if (state.activeVideoBindings.get(key) === cleanup) {
        state.activeVideoBindings.delete(key);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    state.activeVideoBindings.set(key, cleanup);
  };

  const syncScopedObservers = (selectors, registry, callback) => {
    const nextRoots = selectors.map((selector) => document.querySelector(selector)).filter(Boolean);
    const nextRootSet = new Set(nextRoots);

    Array.from(registry.keys()).forEach((root) => {
      if (!nextRootSet.has(root)) {
        registry.get(root)?.disconnect();
        registry.delete(root);
      }
    });

    nextRoots.forEach((root) => {
      if (registry.has(root)) return;
      const observer = new MutationObserver(callback);
      observer.observe(root, { childList: true, subtree: true });
      registry.set(root, observer);
    });
  };

  return {
    bind() {
      const scheduleUiRefresh = debounce(() => {
        uiModule.refresh();
        syncVideoProgress();
      }, REFRESH_DELAY);
      let refreshQueued = false;
      const queueUiRefresh = () => {
        if (refreshQueued) return;
        refreshQueued = true;
        requestAnimationFrame(() => {
          refreshQueued = false;
          scheduleUiRefresh();
        });
      };
      const scheduleAdCleanup = debounce(() => {
        removeAds();
      }, REFRESH_DELAY);

      const syncObservers = () => {
        syncScopedObservers(uiRootSelectors, scopedObservers.ui, () => {
          if (location.href !== state.currentHref) {
            state.currentHref = location.href;
          }
          queueUiRefresh();
        });
        if (!state.settings.enableAdBlocking) {
          disconnectScopedObservers(scopedObservers.ads);
          return;
        }
        syncScopedObservers(adRootSelectors, scopedObservers.ads, (mutations) => {
          let hasAddedNodes = false;
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType !== Node.ELEMENT_NODE) return;
              hasAddedNodes = true;
              removeAds(node);
            });
          });
          if (hasAddedNodes) scheduleAdCleanup();
        });
      };

      refreshAdCleanup = () => {
        syncObservers();
        scheduleAdCleanup();
      };

      const discoveryObserver = new MutationObserver(
        debounce(() => {
          if (location.href !== state.currentHref) {
            state.currentHref = location.href;
            queueUiRefresh();
          }
          syncObservers();
        }, REFRESH_DELAY),
      );
      discoveryObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      const clickRouteProbe = debounce(() => {
        if (location.href !== state.currentHref) {
          state.currentHref = location.href;
          queueUiRefresh();
          syncObservers();
        }
      }, 120);

      window.addEventListener("click", clickRouteProbe, true);
      window.addEventListener("popstate", queueUiRefresh);
      window.addEventListener("hashchange", queueUiRefresh);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          queueUiRefresh();
          scheduleAdCleanup();
          syncObservers();
        }
      });

      window.addEventListener("beforeunload", () => {
        discoveryObserver.disconnect();
        disconnectScopedObservers(scopedObservers.ui);
        disconnectScopedObservers(scopedObservers.ads);
        state.activeVideoBindings.forEach((cleanup) => cleanup());
        state.activeVideoBindings.clear();
        window.removeEventListener("click", clickRouteProbe, true);
        refreshAdCleanup = () => {};
      });

      syncObservers();
      queueUiRefresh();
      scheduleAdCleanup();
    },
    refreshAdBlocking() {
      refreshAdCleanup();
    },
  };
})();

const themeObserver = new MutationObserver(() => {
  const nextTheme =
    document.documentElement.classList.contains("night") ||
    document.documentElement.classList.contains("theme-dark");
  if (nextTheme !== state.themeIsDark) {
    state.themeIsDark = nextTheme;
    notificationFactory.refreshTheme();
    progressFactory.refreshTheme();
    logger.info(`Theme changed to: ${state.themeIsDark ? "dark" : "light"}`);
  }
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});
window.addEventListener("beforeunload", () => themeObserver.disconnect());

const safariSmokeMatrix = () => {
  const preferences = ["browser", "picker", "tab", "auto"];
  const lines = preferences.map((pref) => {
    const resolved = downloadCompatibility.resolveStrategy(pref);
    return `  ${pref.padEnd(7)} → ${resolved}`;
  });
  logger.info(`Strategy matrix on ${IS_SAFARI ? "Safari" : "non-Safari"}:\n${lines.join("\n")}`);
};

const selfTest = (() => {
  const assert = (condition, label) => {
    if (!condition) throw new Error(`FAIL: ${label}`);
    logger.info(`PASS: ${label}`);
  };

  const tests = {
    normalizeSettings() {
      const r1 = normalizeSettings({});
      assert(r1.enableNotifications === true, "normalizeSettings: default enableNotifications");
      assert(r1.downloadLocation === "browser", "normalizeSettings: default downloadLocation");
      const r2 = normalizeSettings({
        enableNotifications: 0,
        downloadLocation: "bad",
      });
      assert(r2.enableNotifications === false, "normalizeSettings: coerce to boolean");
      assert(r2.downloadLocation === "browser", "normalizeSettings: reject invalid location");
      const r3 = normalizeSettings({ downloadLocation: "picker" });
      assert(r3.downloadLocation === "picker", "normalizeSettings: accept valid location");
    },

    extractFileName() {
      const r1 = extractFileName("https://example.com/file.mp4?q=1", "mp4");
      assert(typeof r1 === "string" && r1.length > 0, "extractFileName: returns non-empty string");
      const plain = extractFileName("https://example.com/stream/someid", "mp4");
      assert(plain.endsWith(".mp4"), "extractFileName: appends extension for plain URL");
    },

    resolveStrategy() {
      const valid = new Set(["browser", "picker", "tab"]);
      for (const pref of ["browser", "picker", "tab", "auto"]) {
        const result = downloadCompatibility.resolveStrategy(pref);
        assert(
          valid.has(result),
          `resolveStrategy("${pref}") returns valid strategy (got "${result}")`,
        );
      }
    },

    storageCache() {
      const saved = storageCache.getSettings();
      assert(
        typeof saved === "object" && saved !== null,
        "storageCache.getSettings returns object",
      );
      const p = storageCache.getProgress();
      assert(typeof p === "object" && p !== null, "storageCache.getProgress returns object");
    },
  };

  const run = () => {
    logger.info("─── Self-test start ───");
    let passed = 0;
    let failed = 0;
    for (const [name, fn] of Object.entries(tests)) {
      try {
        fn();
        passed++;
      } catch (err) {
        logger.error(`[selfTest] ${name}: ${err.message}`);
        failed++;
      }
    }
    logger.info(`─── Self-test end: ${passed} passed, ${failed} failed ───`);
    safariSmokeMatrix();
    return failed === 0;
  };

  window.__TEL_SELFTEST__ = run;

  return { run };
})();

const init = () => {
  const runSafe = (label, action) => {
    try {
      action();
    } catch (error) {
      logger.error(`[init] ${label}: ${error.message}`);
    }
  };

  const isDevModeEnabled = () => {
    try {
      return localStorage.getItem("tel_devmode") === "1";
    } catch {
      return false;
    }
  };

  runSafe("progress container", () => progressFactory.ensureContainer());
  runSafe("restore downloads", () => {
    void downloadsModule.restorePendingDownloads().catch((error) => {
      logger.error(`[init] restore downloads: ${error.message}`);
    });
  });
  runSafe("ui refresh", () => uiModule.refresh());
  runSafe("keyboard bind", () => keyboardModule.bind());
  runSafe("observer bind", () => observersModule.bind());
  if (isDevModeEnabled()) runSafe("self-test", () => selfTest.run());
  logger.info(i18n.t("log.init", "Completed script setup. Press ? to open settings."));
};

onDomReady(init);
