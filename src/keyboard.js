// Keyboard shortcuts and playback feedback overlay.
const keyboardModule = (() => {
  let feedbackNode = null;
  let fadeFrame = null;
  const ACTIVE_VIDEO_SELECTORS = [
    `${TELEGRAM_SELECTORS.webKMediaViewer} video`,
    `${TELEGRAM_SELECTORS.webZMediaViewerRoot} video`,
    `${TELEGRAM_SELECTORS.storiesViewer} video`,
    `${TELEGRAM_SELECTORS.storyViewer} video`,
  ];

  const isEditableTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
  };

  const isSettingsShortcut = (event) => {
    // Keep legacy Shift+/ and add common alternatives for different layouts.
    if (event.shiftKey && event.code === "Slash") return true;
    if (event.key === "?") return true;
    if (event.ctrlKey && event.key === ",") return true;
    if (event.metaKey && event.key === ",") return true;
    if (event.ctrlKey && event.shiftKey && event.code === "KeyS") return true;
    if (event.altKey && event.code === "KeyS") return true;

    return false;
  };

  const ensureStyles = () => {
    if (document.getElementById("video-control-styles")) return;
    const style = createElement("style", {
      attributes: { id: "video-control-styles" },
      text: `
        @keyframes tel-notification-pulse {
          0% { transform: translate(-50%, -50%) scale(0.95); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .tel-notification-pulse {
          animation: tel-notification-pulse 0.3s ease-in-out;
        }
        .tel-video-control-notification {
          font-weight: bold;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          background: rgba(32, 38, 57, 0.55);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          color: #fff;
          font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
          font-size: 1.1em;
          letter-spacing: 0.01em;
          transition: opacity 0.3s, background 0.3s;
          padding: 18px 32px;
          min-width: 120px;
          max-width: 90vw;
          text-align: center;
          user-select: none;
        }
      `,
    });
    document.head.appendChild(style);
  };

  const ensureNode = () => {
    const fullscreenHost = document.fullscreenElement || document.webkitFullscreenElement || null;
    const host = fullscreenHost || document.body || document.documentElement;

    if (feedbackNode && feedbackNode.isConnected) {
      if (host && feedbackNode.parentElement !== host) {
        host.appendChild(feedbackNode);
      }
      return feedbackNode;
    }

    feedbackNode = createElement("div", {
      className: "tel-video-control-notification",
      style: styleFactory.keyboardOverlay(),
    });
    appendToRoot(feedbackNode, host);
    return feedbackNode;
  };

  const showFeedback = (message) => {
    ensureStyles();
    const node = ensureNode();
    node.textContent = message;
    node.style.opacity = "1";
    node.classList.add("tel-notification-pulse");
    if (fadeFrame) cancelAnimationFrame(fadeFrame);

    let start = null;
    const fade = (timestamp) => {
      if (start === null) start = timestamp;
      if (timestamp - start > 1500) {
        node.style.opacity = "0";
        node.classList.remove("tel-notification-pulse");
        return;
      }
      fadeFrame = requestAnimationFrame(fade);
    };
    fadeFrame = requestAnimationFrame(fade);
  };

  const togglePictureInPicture = async (video) => {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error(i18n.t("ui.pip.unsupported", "Picture-in-Picture is not supported"));
    }

    if (document.pictureInPictureElement && document.exitPictureInPicture) {
      await document.exitPictureInPicture();
      return i18n.t("ui.pip.exited", "Exited PiP");
    }

    // Some players set this flag preemptively even though toggling works.
    if (video.disablePictureInPicture) {
      try {
        video.disablePictureInPicture = false;
      } catch {}
    }

    if (typeof video.requestPictureInPicture === "function") {
      try {
        await video.requestPictureInPicture();
        return i18n.t("ui.pip.entered", "Entered PiP");
      } catch (error) {
        if (typeof video.webkitSetPresentationMode !== "function") {
          throw error;
        }
      }
    }

    if (typeof video.webkitSetPresentationMode === "function") {
      const nextMode =
        video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
      video.webkitSetPresentationMode(nextMode);
      return nextMode === "inline"
        ? i18n.t("ui.pip.exited", "Exited PiP")
        : i18n.t("ui.pip.entered", "Entered PiP");
    }

    throw new Error(i18n.t("ui.pip.unsupported", "Picture-in-Picture is not supported"));
  };

  return {
    bind() {
      const syncFeedbackHost = () => {
        if (!feedbackNode) return;
        ensureNode();
      };

      const handleSettingsShortcut = (event) => {
        if (!isSettingsShortcut(event)) return;
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        settingsModule.show();
      };

      const handleSettingsClose = (event) => {
        if (event.key !== "Escape") return;
        if (isEditableTarget(event.target)) return;
        const panel = document.getElementById("tel-settings-overlay");
        if (!panel || panel.style.display === "none") return;
        event.preventDefault();
        settingsModule.hide();
      };

      document.addEventListener("keydown", handleSettingsShortcut, true);
      document.addEventListener("keydown", handleSettingsClose, true);
      document.addEventListener("fullscreenchange", syncFeedbackHost, true);
      document.addEventListener("webkitfullscreenchange", syncFeedbackHost, true);

      document.addEventListener("keydown", (event) => {
        if (!state.settings.enableKeyboardShortcuts) return;
        if (isEditableTarget(event.target)) return;

        const media = getActiveMediaContext();
        const fallbackVideo = ACTIVE_VIDEO_SELECTORS.map((selector) =>
          document.querySelector(selector),
        ).find((candidate) => candidate instanceof HTMLVideoElement);
        const video = media?.video || fallbackVideo;
        if (!video) return;

        switch (event.code) {
          case "ArrowRight":
            event.preventDefault();
            video.currentTime = Math.min(video.duration, video.currentTime + 5);
            showFeedback(`(${Math.floor(video.currentTime)}s)`);
            break;
          case "ArrowLeft":
            event.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 5);
            showFeedback(`(${Math.floor(video.currentTime)}s)`);
            break;
          case "ArrowUp":
            event.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            showFeedback(`${Math.round(video.volume * 100)}%`);
            break;
          case "ArrowDown":
            event.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            showFeedback(`${Math.round(video.volume * 100)}%`);
            break;
          case "KeyM":
            event.preventDefault();
            video.muted = !video.muted;
            showFeedback(
              video.muted ? i18n.t("ui.muted", "Muted") : i18n.t("ui.unmuted", "Unmuted"),
            );
            break;
          case "KeyP":
            event.preventDefault();
            togglePictureInPicture(video)
              .then(showFeedback)
              .catch((error) => {
                const fallbackMessage = i18n.t(
                  "ui.pip.unsupported",
                  "Picture-in-Picture is not supported",
                );
                const message = String(error?.message || fallbackMessage);
                showFeedback(message);
                logger.error(message);
              });
            break;
          case "Home":
            event.preventDefault();
            video.currentTime = 0;
            showFeedback("(0s)");
            break;
          default:
            return;
        }

        event.stopPropagation();
      });
    },
  };
})();
