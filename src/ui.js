/* global TELEGRAM_SELECTORS */

// Thin facade that composes UI refresh responsibilities.
const uiModule = (() => {
  return {
    refresh() {
      uiMediaButtons.refresh();
      uiLauncher.refresh();
    },
  };
})();

// Floating settings launcher UI.
const uiLauncher = (() => {
  const settingsLabel = () => i18n.t("settings.title", "Settings");

  const getSettingsLauncherStyles = (isDark) => ({
    position: "fixed",
    right: "14px",
    bottom: "24px",
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)",
    background: isDark ? "rgba(28, 34, 44, 0.78)" : "rgba(255,255,255,0.85)",
    color: isDark ? "#f2f4f8" : "#20242c",
    boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.45)" : "0 8px 24px rgba(0,0,0,0.18)",
    backdropFilter: "blur(8px) saturate(140%)",
    WebkitBackdropFilter: "blur(8px) saturate(140%)",
    cursor: "pointer",
    zIndex: "1599",
    fontSize: "21px",
    lineHeight: "1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    transition: "transform .15s ease, box-shadow .15s ease, background .2s ease",
  });

  const ensureSettingsLauncher = () => {
    let launcher = document.getElementById("tel-settings-launcher");
    if (!(launcher instanceof HTMLButtonElement)) {
      launcher = createElement("button", {
        type: "button",
        text: "⚙",
        attributes: { id: "tel-settings-launcher" },
        ariaLabel: settingsLabel(),
        title: settingsLabel(),
      });
      launcher.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        settingsModule.show();
      });
      launcher.addEventListener("mouseenter", () => {
        launcher.style.transform = "translateY(-1px)";
      });
      launcher.addEventListener("mouseleave", () => {
        launcher.style.transform = "translateY(0)";
      });
      appendToRoot(launcher);
    }

    applyStyles(launcher, getSettingsLauncherStyles(getTheme()));
    launcher.setAttribute("aria-label", settingsLabel());
    launcher.title = settingsLabel();
  };

  return {
    refresh() {
      ensureSettingsLauncher();
    },
  };
})();

// UI media helpers and media-button injections for Telegram Web variants.
const getText = (...selectors) => {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return "";
};

const getActiveMediaContext = () => {
  const candidates = [
    {
      root: document.querySelector(TELEGRAM_SELECTORS.webKMediaViewer),
      videoSelector: "video",
      titleSelectors: [".media-viewer-name .peer-title"],
      metaSelectors: [".media-viewer-date"],
      prefix: "webk-media",
    },
    {
      root: document.querySelector(TELEGRAM_SELECTORS.webZActiveSlide),
      videoSelector: "video",
      titleSelectors: [
        `${TELEGRAM_SELECTORS.webZProfileInfo} .fullName`,
        `${TELEGRAM_SELECTORS.webZMediaViewerRoot} .fullName`,
        `${TELEGRAM_SELECTORS.webZMediaViewerRoot} .Title`,
      ],
      metaSelectors: [
        TELEGRAM_SELECTORS.webZMessageMeta,
        `${TELEGRAM_SELECTORS.webZMediaViewerRoot} .subtitle`,
      ],
      prefix: "webz-media",
    },
    {
      root: document.querySelector(TELEGRAM_SELECTORS.storiesViewer),
      videoSelector: "video.media-video",
      titleSelectors: [`${TELEGRAM_SELECTORS.storiesViewer} [class*='ViewerStoryTitle']`],
      metaSelectors: [],
      prefix: "webk-story",
    },
    {
      root: document.querySelector(TELEGRAM_SELECTORS.storyViewer),
      videoSelector: "video",
      titleSelectors: [
        `${TELEGRAM_SELECTORS.storyViewer} .fullName`,
        `${TELEGRAM_SELECTORS.storyViewer} .Title`,
      ],
      metaSelectors: [],
      prefix: "webz-story",
    },
  ];

  for (const candidate of candidates) {
    const video = candidate.root?.querySelector(candidate.videoSelector);
    if (!video) continue;
    const sourceUrl = video.currentSrc || video.src;
    if (!sourceUrl) continue;
    const title = getText(...candidate.titleSelectors);
    const meta = getText(...candidate.metaSelectors);
    const storageSource =
      title || meta
        ? `${candidate.prefix}:${title}:${meta}`
        : `${candidate.prefix}:${location.pathname}:${sourceUrl}`;
    return {
      video,
      key: `${candidate.prefix}:${hashCode(storageSource).toString(36)}`,
    };
  }

  const fallbackVideos = [
    {
      selector: `${TELEGRAM_SELECTORS.webKMediaViewer} video`,
      prefix: "webk-fallback",
    },
    {
      selector: `${TELEGRAM_SELECTORS.webZMediaViewerRoot} video`,
      prefix: "webz-fallback",
    },
    {
      selector: `${TELEGRAM_SELECTORS.storiesViewer} video`,
      prefix: "story-fallback",
    },
    {
      selector: `${TELEGRAM_SELECTORS.storyViewer} video`,
      prefix: "story-fallback-z",
    },
  ];

  for (const fallback of fallbackVideos) {
    const video = document.querySelector(fallback.selector);
    if (!(video instanceof HTMLVideoElement)) continue;
    const sourceUrl = video.currentSrc || video.src;
    if (!sourceUrl) continue;
    const keySource = `${fallback.prefix}:${location.pathname}:${sourceUrl}`;
    return {
      video,
      key: `${fallback.prefix}:${hashCode(keySource).toString(36)}`,
    };
  }

  return null;
};

const getCandidateMediaUrl = (mediaElement) => {
  if (!(mediaElement instanceof HTMLMediaElement)) return null;

  const candidates = [
    mediaElement.currentSrc,
    mediaElement.getAttribute("src"),
    mediaElement.querySelector("source")?.getAttribute("src"),
  ];

  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;

    try {
      const parsed = new URL(raw, location.href);
      const path = parsed.pathname || "/";
      const isPageLikeUrl =
        parsed.origin === location.origin &&
        (path === "/" || path === "/k" || path === "/k/" || path === "/z" || path === "/z/");
      if (!isPageLikeUrl) return parsed.href;
    } catch {}
  }

  return null;
};

const isBlobMediaUrl = (url) => /^blob:/i.test(String(url || "").trim());

const isMseLikeVideo = (mediaElement, resolvedUrl = "") => {
  if (!(mediaElement instanceof HTMLVideoElement)) return false;
  if (isBlobMediaUrl(resolvedUrl)) return true;

  try {
    if (
      typeof MediaSource !== "undefined" &&
      mediaElement.srcObject &&
      mediaElement.srcObject instanceof MediaSource
    ) {
      return true;
    }
  } catch {}

  return false;
};

const uiMediaButtons = (() => {
  const downloadLabel = () => i18n.t("ui.download", "Download");
  const openSourceLabel = () => i18n.t("ui.openSource", "Open source/message");
  const WEBK_BUTTON_VARIANTS = Object.freeze({
    pinned: "btn-icon tgico-download tel-download-pinned",
    story: "btn-icon rp tel-download tel-download-story",
    ckin: "btn-icon default__button tgico-download tel-download tel-download-ckin",
    media: "btn-icon tgico-download tel-download tel-download-media",
  });
  const WEBZ_BUTTON_VARIANTS = Object.freeze({
    story: "Button TkphaPyQ tiny translucent-white round tel-download tel-download-webz-story",
    media: "Button smaller translucent-white round tel-download tel-download-webz-media",
    video: "Button smaller translucent-white round tel-download tel-download-webz-video",
  });

  const resolveMediaButtonTitle = (mediaElement, resolvedUrl) => {
    if (!isMseLikeVideo(mediaElement, resolvedUrl)) return downloadLabel();
    const streamHint = state?.settings?.enableExperimentalStreamCapture
      ? ""
      : " · Shift+Click = capture";
    return `${openSourceLabel()}${streamHint}`;
  };

  const resolveSourceMessageUrl = (contextRoot, fallbackUrl = "") => {
    const roots = [
      contextRoot,
      contextRoot?.closest?.(TELEGRAM_SELECTORS.webKMediaViewer),
      document,
    ].filter(Boolean);
    const selectors = [
      ".media-viewer-date a[href]",
      ".media-viewer-name a[href]",
      `${TELEGRAM_SELECTORS.webZMessageMeta} a[href]`,
      `${TELEGRAM_SELECTORS.webZProfileInfo} a[href]`,
      `${TELEGRAM_SELECTORS.storiesViewer} a[href]`,
      `${TELEGRAM_SELECTORS.storyViewer} a[href]`,
      "a[href*='t.me/']",
      "a[href*='telegram.org']",
    ];

    for (const root of roots) {
      for (const selector of selectors) {
        const anchor = root.querySelector(selector);
        if (!anchor) continue;
        const href = String(anchor.getAttribute("href") || "").trim();
        if (!href || href.startsWith("javascript:")) continue;
        try {
          return new URL(href, location.href).href;
        } catch {}
      }
    }

    const fallback = String(fallbackUrl || "").trim();
    if (fallback && !isBlobMediaUrl(fallback)) {
      return fallback;
    }
    return location.href;
  };

  const openSourceMessage = (contextRoot, fallbackUrl = "") => {
    const targetUrl = resolveSourceMessageUrl(contextRoot, fallbackUrl);
    const opened = openInNewTab(targetUrl);
    if (!opened) {
      showNotificationIfEnabled(
        i18n.t(
          "notification.streamSourceNotFound",
          "Unable to open source/message link from this media viewer.",
        ),
        "error",
      );
      return false;
    }
    return true;
  };

  const handleVideoAction = async ({ videoElement, contextRoot, clickEvent }) => {
    const videoUrl = getCandidateMediaUrl(videoElement);
    if (!videoUrl) return;

    if (isMseLikeVideo(videoElement, videoUrl)) {
      const captureEnabled = Boolean(state?.settings?.enableExperimentalStreamCapture);
      const shouldCapture = Boolean(clickEvent?.shiftKey) || captureEnabled;
      if (shouldCapture) {
        const captured = await downloadsModule.captureStreamedVideo(videoElement, {
          maxDurationMs: 12000,
        });
        if (captured) {
          showNotificationIfEnabled(
            i18n.t(
              "notification.streamCaptureSaved",
              "Stream fragment was captured and saved (experimental).",
            ),
            "success",
          );
          return;
        }
      }

      openSourceMessage(contextRoot, videoUrl);
      return;
    }

    downloadsModule.downloadVideo(videoUrl);
  };

  const downloadVisualByUrl = (url) => {
    const normalized = String(url || "").toLowerCase();
    if (!normalized) return;

    if (/\.(webp|tgs)(\?|$)/.test(normalized) || normalized.includes("sticker")) {
      downloadsModule.downloadSticker(url);
      return;
    }

    if (/\.gif(\?|$)/.test(normalized) || normalized.includes("gif")) {
      downloadsModule.downloadGif(url);
      return;
    }

    downloadsModule.downloadImage(url);
  };

  const safeInvokeButtonAction = (label, handler) => {
    const handleError = (error) => {
      logger.error(`${label}: ${error?.message || error}`);
      const message = i18n.t("notification.downloadFailed", "Download failed");
      showNotificationIfEnabled(`${message}${error?.message ? `: ${error.message}` : ""}`, "error");
    };

    try {
      const maybePromise = handler();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  };

  const createWebZActionButton = ({ variant, title, onClick }) => {
    const button = createElement("button", {
      className: WEBZ_BUTTON_VARIANTS[variant] || WEBZ_BUTTON_VARIANTS.media,
      type: "button",
      title,
      ariaLabel: title,
    });
    button.appendChild(createElement("i", { className: "icon icon-download" }));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      safeInvokeButtonAction(title, () => onClick(event));
    });
    return button;
  };

  const createWebKActionButton = ({ variant, title, onClick, extras = [] }) => {
    const button = createElement("button", {
      className: WEBK_BUTTON_VARIANTS[variant] || WEBK_BUTTON_VARIANTS.media,
      type: "button",
      title,
      ariaLabel: title,
    });
    setButtonIconContent(button, DOWNLOAD_ICON, "tgico button-icon", extras);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      safeInvokeButtonAction(title, () => onClick(event));
    });
    return button;
  };

  const injectPinnedAudioButton = () => {
    const pinnedAudio = document.querySelector(".pinned-audio");
    const utils = pinnedAudio?.querySelector(".pinned-container-wrapper-utils");
    const dataMid = pinnedAudio?.getAttribute("data-mid");
    if (!utils || !dataMid) return;

    const existingButton = utils.querySelector(".tel-download-pinned");
    if (existingButton?.dataset.mid === dataMid) return;
    existingButton?.remove();

    const audioElement = Array.from(document.querySelectorAll("audio-element")).find(
      (item) => item.getAttribute("data-mid") === dataMid,
    );
    const link = audioElement?.audio?.getAttribute("src");
    if (!link) return;

    const button = createWebKActionButton({
      variant: "pinned",
      title: downloadLabel(),
      onClick: () => {
        if (audioElement.audio instanceof HTMLAudioElement) {
          downloadsModule.downloadAudio(link);
        } else {
          downloadsModule.downloadVideo(link);
        }
      },
    });
    button.dataset.mid = dataMid;
    utils.appendChild(button);
  };

  const injectWebKStoriesButton = () => {
    const stories = document.getElementById("stories-viewer");
    const header = stories?.querySelector("[class^='_ViewerStoryHeaderRight']");
    if (!header || header.querySelector(".tel-download-story")) return;

    const ripple = createElement("div", { className: "c-ripple" });
    const storyVideo = stories.querySelector("video.media-video");
    const storyVideoUrl = getCandidateMediaUrl(storyVideo);
    const title = resolveMediaButtonTitle(storyVideo, storyVideoUrl);
    const button = createWebKActionButton({
      variant: "story",
      title,
      extras: [ripple],
      onClick: (event) => {
        const video = stories.querySelector("video.media-video");
        if (video) {
          return handleVideoAction({
            videoElement: video,
            contextRoot: stories,
            clickEvent: event,
          });
        }
        const imageUrl = stories.querySelector("img.media-photo")?.src;
        if (imageUrl) downloadVisualByUrl(imageUrl);
      },
    });
    header.prepend(button);
  };

  const injectWebZStoriesButton = () => {
    const stories = document.getElementById("StoryViewer");
    const header =
      stories?.querySelector(".GrsJNw3y") || stories?.querySelector(".DropdownMenu")?.parentNode;
    if (!header || header.querySelector(".tel-download-webz-story")) return;

    const storyVideo = stories.querySelector("video");
    const storyVideoUrl = getCandidateMediaUrl(storyVideo);
    const title = resolveMediaButtonTitle(storyVideo, storyVideoUrl);

    const button = createWebZActionButton({
      variant: "story",
      title,
      onClick: (event) => {
        const video = stories.querySelector("video");
        if (video) {
          return handleVideoAction({
            videoElement: video,
            contextRoot: stories,
            clickEvent: event,
          });
        }
        const images = Array.from(stories.querySelectorAll("img"));
        const imageUrl = images[images.length - 1]?.src;
        if (imageUrl) downloadVisualByUrl(imageUrl);
      },
    });
    header.insertBefore(button, header.querySelector("button") || null);
  };

  const suppressBuiltInDownloadButtons = (buttonsRoot) => {
    buttonsRoot.querySelectorAll("button.btn-icon").forEach((button) => {
      if (button.classList.contains("tel-download")) return;
      if (button.textContent === FORWARD_ICON) {
        button.classList.add("tgico-forward");
      }
      if (button.textContent === DOWNLOAD_ICON) {
        button.classList.add("hide");
        button.setAttribute("aria-hidden", "true");
        button.style.display = "none";
      }
    });
  };

  const injectWebKMediaViewerButton = () => {
    const mediaContainer = document.querySelector(TELEGRAM_SELECTORS.webKMediaViewer);
    const aspecter = mediaContainer?.querySelector(".media-viewer-movers .media-viewer-aspecter");
    const buttons = mediaContainer?.querySelector(".media-viewer-topbar .media-viewer-buttons");
    if (!aspecter || !buttons) return;

    suppressBuiltInDownloadButtons(buttons);

    if (aspecter.querySelector(".ckin__player")) {
      const controls = aspecter.querySelector(
        ".default__controls.ckin__controls .bottom-controls .right-controls",
      );
      if (!controls || controls.querySelector(".tel-download-ckin")) return;
      const ckinVideo = aspecter.querySelector("video");
      const ckinVideoUrl = getCandidateMediaUrl(ckinVideo);
      const title = resolveMediaButtonTitle(ckinVideo, ckinVideoUrl);
      const button = createWebKActionButton({
        variant: "ckin",
        title,
        onClick: (event) => {
          const video = aspecter.querySelector("video");
          if (video) {
            return handleVideoAction({
              videoElement: video,
              contextRoot: mediaContainer,
              clickEvent: event,
            });
          }
        },
      });
      controls.prepend(button);
      return;
    }

    if (buttons.querySelector(".tel-download-media")) return;
    const mediaVideo = aspecter.querySelector("video");
    const mediaVideoUrl = getCandidateMediaUrl(mediaVideo);
    const title = resolveMediaButtonTitle(mediaVideo, mediaVideoUrl);
    const button = createWebKActionButton({
      variant: "media",
      title,
      onClick: (event) => {
        const video = aspecter.querySelector("video");
        if (video) {
          return handleVideoAction({
            videoElement: video,
            contextRoot: mediaContainer,
            clickEvent: event,
          });
        }
        const image = aspecter.querySelector("img.thumbnail");
        if (image?.src) downloadVisualByUrl(image.src);
      },
    });
    buttons.prepend(button);
  };

  const injectWebZMediaViewerButton = () => {
    const slide = document.querySelector(TELEGRAM_SELECTORS.webZActiveSlide);
    const actions = document.querySelector(TELEGRAM_SELECTORS.webZActions);
    if (!slide || !actions) return;

    const nativeButtons = Array.from(actions.querySelectorAll('button[title="Download"]')).filter(
      (button) => !button.classList.contains("tel-download"),
    );
    const existingButton = actions.querySelector("button.tel-download-webz-media");
    if (nativeButtons.length > 0) {
      existingButton?.remove();
      return;
    }

    const videoPlayer = slide.querySelector(".MediaViewerContent > .VideoPlayer");
    const videoElement = videoPlayer?.querySelector("video");
    const videoUrl = getCandidateMediaUrl(videoElement);
    const image = slide.querySelector(".MediaViewerContent > div > img");
    const targetUrl = videoUrl || image?.src;
    if (!targetUrl) return;

    const title = resolveMediaButtonTitle(videoElement, videoUrl);

    const onClick = (event) => {
      if (videoElement) {
        return handleVideoAction({
          videoElement,
          contextRoot: slide,
          clickEvent: event,
        });
      }
      if (image?.src) downloadVisualByUrl(image.src);
    };

    if (existingButton) {
      if (existingButton.dataset.telDownloadUrl !== targetUrl) {
        existingButton.dataset.telDownloadUrl = targetUrl;
        existingButton.title = title;
        existingButton.setAttribute("aria-label", title);
        existingButton.onclick = (event) => safeInvokeButtonAction(title, () => onClick(event));
      }
    } else {
      const button = createWebZActionButton({
        variant: "media",
        title,
        onClick,
      });
      button.dataset.telDownloadUrl = targetUrl;
      actions.prepend(button);
    }

    const controls = videoPlayer?.querySelector(".VideoPlayerControls .buttons");
    if (controls && !controls.querySelector(".tel-download-webz-video")) {
      const controlButton = createWebZActionButton({
        variant: "video",
        title,
        onClick: (event) => {
          const currentVideo = videoPlayer?.querySelector("video");
          if (!currentVideo) return;
          return handleVideoAction({
            videoElement: currentVideo,
            contextRoot: slide,
            clickEvent: event,
          });
        },
      });
      controls.querySelector(".spacer")?.after(controlButton);
    }
  };

  return {
    refresh() {
      injectPinnedAudioButton();
      injectWebKStoriesButton();
      injectWebZStoriesButton();
      injectWebKMediaViewerButton();
      injectWebZMediaViewerButton();
    },
  };
})();
