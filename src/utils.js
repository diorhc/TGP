const onDomReady = (callback) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
};

const appendToRoot = (node, preferredParent = document.body) => {
  const parent = preferredParent || document.body || document.documentElement;
  if (!parent) return false;
  parent.appendChild(node);
  return true;
};

const applyStyles = (element, ...styles) => {
  Object.assign(element.style, ...styles.filter(Boolean));
  return element;
};

const createElement = (tagName, options = {}) => {
  const element = document.createElement(tagName);
  const {
    className,
    text,
    htmlFor,
    type,
    value,
    checked,
    title,
    role,
    ariaLabel,
    tabIndex,
    style,
    attributes,
  } = options;

  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  if (typeof htmlFor === "string") element.htmlFor = htmlFor;
  if (typeof type === "string") element.type = type;
  if (typeof value === "string") element.value = value;
  if (typeof checked === "boolean") element.checked = checked;
  if (typeof title === "string") element.title = title;
  if (typeof role === "string") element.setAttribute("role", role);
  if (typeof ariaLabel === "string") element.setAttribute("aria-label", ariaLabel);
  if (typeof tabIndex === "number") element.tabIndex = tabIndex;
  if (style) applyStyles(element, style);
  if (attributes) {
    Object.entries(attributes).forEach(([key, attributeValue]) => {
      element.setAttribute(key, attributeValue);
    });
  }

  return element;
};

const debounce = (func, wait) => {
  let timeout;
  return function debouncedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const randomId = (prefix = "task") =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

const getTheme = () => state.themeIsDark;

const triggerAnchorDownload = (href, fileName) => {
  const anchor = document.createElement("a");
  anchor.href = href;
  if (fileName) anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  if (appendToRoot(anchor)) {
    anchor.click();
    anchor.remove();
    return true;
  }

  return false;
};

const openInNewTab = (href) => {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.rel = "noopener";
  anchor.target = "_blank";
  anchor.style.display = "none";

  if (appendToRoot(anchor)) {
    anchor.click();
    anchor.remove();
    return true;
  }

  const openedWindow = window.open(href, "_blank", "noopener");
  return Boolean(openedWindow);
};

const openWithFallback = (href, fileName, strategy) => {
  if (strategy === "tab") {
    if (openInNewTab(href)) return "tab";
    if (triggerAnchorDownload(href, fileName)) return "browser";
    return "failed";
  }

  if (triggerAnchorDownload(href, fileName)) return "browser";
  if (openInNewTab(href)) return "tab";
  return "failed";
};

const setButtonIconContent = (button, iconChar, className = "tgico", extras = []) => {
  button.replaceChildren();
  const iconSpan = createElement("span", {
    className,
    text: iconChar,
  });
  button.appendChild(iconSpan);
  extras.forEach((node) => {
    if (node instanceof HTMLElement) button.appendChild(node);
  });
  return iconSpan;
};

const styleFactory = {
  glassPanel(isDark) {
    return {
      backgroundColor: isDark ? "rgba(18,20,24,0.75)" : "rgba(255,255,255,0.75)",
      color: isDark ? "#eaeaea" : "var(--primary-text-color, #000)",
      border: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.6)",
      boxShadow: isDark ? "0 12px 48px rgba(0,0,0,0.6)" : "0 12px 48px rgba(16,24,40,0.12)",
      backdropFilter: "blur(12px) saturate(130%)",
      WebkitBackdropFilter: "blur(12px) saturate(130%)",
    };
  },
  toast(type, isDark) {
    const colors = {
      info: "#2196F3",
      error: "#f44336",
      success: "#4CAF50",
      warning: "#FF9800",
    };
    return {
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
      color: isDark ? "#eaeaea" : "#111",
      padding: "12px 16px",
      borderRadius: "12px",
      border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.6)",
      boxShadow: isDark ? "0 6px 24px rgba(0,0,0,0.6)" : "0 6px 24px rgba(16,24,40,0.12)",
      fontSize: "14px",
      fontWeight: "600",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
      animation: "tel-slideIn 360ms cubic-bezier(.2,.9,.2,1)",
      cursor: "pointer",
      wordWrap: "break-word",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      overflow: "hidden",
      position: "relative",
      accentColor: colors[type] || colors.info,
    };
  },
  modalOverlay(zIndex = "10002") {
    return {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(10, 12, 16, 0.55)",
      zIndex,
      display: "none",
      justifyContent: "center",
      alignItems: "center",
      backdropFilter: "blur(6px)",
    };
  },
  progressContainer() {
    return {
      position: "fixed",
      right: "0",
      bottom: "7%",
      zIndex: location.pathname.startsWith("/k/") ? "4" : "1600",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "8px",
      maxHeight: "70vh",
      overflowY: "auto",
    };
  },
  progressCard(isDark) {
    return {
      width: "20rem",
      padding: "0.7rem",
      borderRadius: "12px",
      ...styleFactory.glassPanel(isDark),
    };
  },
  progressBar(isDark) {
    return {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.06)",
      position: "relative",
      width: "100%",
      height: "1.6rem",
      borderRadius: "1.2rem",
      overflow: "hidden",
      border: isDark ? "1px solid rgba(255,255,255,0.02)" : "1px solid rgba(0,0,0,0.04)",
    };
  },
  progressLabel(isDark) {
    return {
      position: "absolute",
      zIndex: "5",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      margin: "0",
      color: isDark ? "#fff" : "#111",
      fontWeight: "700",
      fontSize: "0.9rem",
      whiteSpace: "nowrap",
    };
  },
  progressFill(color) {
    return {
      position: "absolute",
      height: "100%",
      width: "0%",
      background: color,
      boxShadow: "0 4px 18px rgba(96,147,181,0.18)",
    };
  },
  keyboardOverlay() {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "white",
      padding: "10px 20px",
      borderRadius: "5px",
      fontSize: "18px",
      opacity: "0",
      transition: "opacity 0.3s ease",
      zIndex: "2147483647",
      pointerEvents: "none",
    };
  },
};

const notificationFactory = (() => {
  const ensureStyles = () => {
    if (document.getElementById("tel-notification-styles")) return;
    const style = createElement("style", {
      attributes: { id: "tel-notification-styles" },
      text: `
        @keyframes tel-slideIn {
          from { transform: translateX(16px) scale(.98); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes tel-slideOut {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to { transform: translateX(10px) scale(.98); opacity: 0; }
        }
        #tel-notification-container > div {
          will-change: transform, opacity;
        }
      `,
    });
    document.head.appendChild(style);
  };

  const ensureContainer = () => {
    let container = document.getElementById("tel-notification-container");
    if (container) return container;
    container = createElement("div", {
      attributes: { id: "tel-notification-container" },
      style: {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "10001",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "400px",
      },
    });
    appendToRoot(container);
    return container;
  };

  const show = (message, type = "info", duration = 3000) => {
    try {
      ensureStyles();
      const container = ensureContainer();
      while (container.children.length >= MAX_NOTIFICATIONS) {
        container.firstElementChild?.remove();
      }

      const notification = createElement("div", {
        role: type === "error" ? "alert" : "status",
        tabIndex: 0,
      });
      notification.dataset.telNotificationType = type;
      const styles = styleFactory.toast(type, getTheme());
      applyStyles(notification, styles);
      notification.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
      notification.setAttribute("aria-atomic", "true");

      const accent = createElement("span", {
        style: {
          width: "6px",
          height: "100%",
          borderRadius: "4px",
          flex: "0 0 6px",
          background: styles.accentColor,
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.08)",
        },
      });
      const text = createElement("span", { text: message });
      notification.append(accent, text);
      notification.addEventListener("click", () => notification.remove());
      notification.addEventListener("keydown", (event) => {
        if (["Enter", " ", "Escape"].includes(event.key)) {
          event.preventDefault();
          notification.remove();
        }
      });

      container.appendChild(notification);
      setTimeout(() => {
        notification.style.animation = "tel-slideOut 0.3s ease-out";
        setTimeout(() => notification.remove(), 300);
      }, duration);
    } catch (error) {
      logger.error(`Failed to show notification: ${error.message}`);
    }
  };

  const refreshTheme = () => {
    const container = document.getElementById("tel-notification-container");
    if (!container) return;

    container.querySelectorAll(":scope > div").forEach((notification) => {
      const type = notification.dataset.telNotificationType || "info";
      const styles = styleFactory.toast(type, getTheme());
      applyStyles(notification, styles);

      const accent = notification.firstElementChild;
      if (accent instanceof HTMLElement) {
        accent.style.background = styles.accentColor;
      }
    });
  };

  return { show, refreshTheme };
})();

const SETTINGS_PANEL_CSS = `
  .tel-settings-shell {
    width: min(860px, 96vw);
    color: #f4f5f7;
    overflow: visible;
  }
  .tel-settings-main {
    flex: 1;
    min-width: 0;
  }
  .tel-settings-toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 14px;
  }
  .tel-settings-toolbar .tel-settings-topbar-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tel-settings-toolbar .tel-settings-topbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
    justify-content: flex-end;
  }
  .tel-settings-toolbar-center {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
  }
  .tel-settings-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    width: 100%;
    box-sizing: border-box;
    padding: 0 0 18px;
  }
  .tel-settings-title-pill,
  .tel-settings-save-btn,
  .tel-settings-action-btn {
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.26);
    color: #fff;
    background: rgba(255,255,255,0.06);
    font-weight: 600;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .tel-settings-title-pill {
    padding: 10px 16px;
    font-size: 14px;
  }
  .tel-settings-topbar-left,
  .tel-settings-topbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tel-settings-save-btn {
    font-size: 18px;
    padding: 12px 24px;
    background: linear-gradient(180deg, rgba(121,20,77,0.82) 0%, rgba(92,16,59,0.88) 100%);
    cursor: pointer;
  }
  .tel-settings-action-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .tel-settings-action-btn svg,
  .tel-settings-sidebar-btn svg {
    width: 20px;
    height: 20px;
    display: block;
  }
  .tel-settings-sidebar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 10px;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.2);
    background: linear-gradient(180deg, rgba(36,56,84,0.68) 0%, rgba(20,30,48,0.74) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 32px rgba(0,0,0,0.26);
    align-self: center;
  }
  .tel-settings-sidebar-btn {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.86);
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background .2s ease, border-color .2s ease, transform .15s ease;
  }
  .tel-settings-sidebar-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(255,255,255,0.34);
    background: rgba(255,255,255,0.1);
  }
  .tel-settings-sidebar-btn.is-active {
    border-color: rgba(255,255,255,0.48);
    background: linear-gradient(180deg, rgba(106,145,191,0.42) 0%, rgba(70,105,149,0.4) 100%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
  }
  .tel-settings-close-btn {
    border: 1px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.08);
    color: #fff;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 23px;
    line-height: 1;
    flex-shrink: 0;
  }
  .tel-settings-content {
    flex: 1;
    width: 100%;
  }
  .tel-settings-view-host {
    flex: 1;
    min-width: 0;
  }
  .tel-settings-view {
    width: 100%;
  }
  .tel-settings-view-card {
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.18);
    background: linear-gradient(180deg, rgba(43,48,71,0.92) 0%, rgba(31,35,49,0.92) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 48px rgba(0,0,0,0.28);
    padding: 18px 20px;
  }
  .tel-settings-content-row {
    display: flex;
    align-items: stretch;
    gap: 14px;
  }
  .tel-settings-center-column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .tel-settings-actions-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    min-height: 100%;
    padding-top: 9%;
  }
  .tel-settings-list {
    flex: 1;
    min-width: 0;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.18);
    background: linear-gradient(180deg, rgba(43,48,71,0.92) 0%, rgba(31,35,49,0.92) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 48px rgba(0,0,0,0.28);
    overflow: hidden;
  }
  .tel-settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    cursor: pointer;
    user-select: none;
    transition: background .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s cubic-bezier(.4,0,.2,1);
  }
  .tel-settings-row--toggle:hover {
    background: rgba(255,255,255,0.04);
    transform: translateX(6px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .tel-settings-row + .tel-settings-row {
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .tel-settings-row-title {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    color: #fff;
  }
  .tel-settings-row-desc {
    margin: 4px 0 0;
    font-size: 14px;
    color: rgba(227,231,240,0.78);
    line-height: 1.4;
  }
  .tel-settings-row-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .tel-settings-check {
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    margin: 0;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.32);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all 250ms cubic-bezier(.4,0,.23,1);
    position: relative;
    flex-shrink: 0;
    color: #f5f7fb;
    box-sizing: border-box;
  }
  .tel-settings-row--toggle:hover .tel-settings-check {
    background: rgba(255,255,255,0.08);
    transform: scale(1.1);
  }
  .tel-settings-check::before {
    content: "";
    width: 5px;
    height: 2px;
    background: currentColor;
    position: absolute;
    transform: rotate(45deg);
    top: 6px;
    left: 3px;
    transition: width 100ms ease 50ms, opacity 50ms;
    transform-origin: 0% 0%;
    opacity: 0;
  }
  .tel-settings-check::after {
    content: "";
    width: 0;
    height: 2px;
    background: currentColor;
    position: absolute;
    transform: rotate(305deg);
    top: 12px;
    left: 7px;
    transition: width 100ms ease, opacity 50ms;
    transform-origin: 0% 0%;
    opacity: 0;
  }
  .tel-settings-check.is-on {
    transform: scale(1.15);
  }
  .tel-settings-check.is-on::before {
    width: 9px;
    opacity: 1;
    transition: width 150ms ease 100ms, opacity 150ms ease 100ms;
  }
  .tel-settings-check.is-on::after {
    width: 16px;
    opacity: 1;
    transition: width 150ms ease 250ms, opacity 150ms ease 250ms;
  }
  .tel-settings-hidden-input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
  .tel-settings-row:focus-visible .tel-settings-check,
  .tel-settings-report-debug:focus-visible .tel-settings-check {
    outline: 2px solid rgba(255,255,255,0.9);
    outline-offset: 2px;
  }
  .tel-settings-select-wrap { margin-top: 10px; }
  .tel-settings-select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.24);
    background: rgba(18,23,35,0.82);
    color: #fff;
    font-size: 15px;
    padding: 12px 14px;
  }
  .tel-settings-info-row {
    cursor: default !important;
  }
  .tel-settings-save-btn:focus-visible,
  .tel-settings-action-btn:focus-visible,
  .tel-settings-secondary-btn:focus-visible,
  .tel-settings-close-btn:focus-visible,
  .tel-settings-sidebar-btn:focus-visible,
  .tel-settings-row:focus-visible,
  .tel-settings-select:focus-visible {
    outline: 2px solid rgba(255,255,255,0.9);
    outline-offset: 2px;
  }
  .tel-settings-secondary-btn {
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.08);
    color: #fff;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
  }
  .tel-settings-link-btn,
  .tel-settings-update-btn,
  .tel-settings-update-icon-btn {
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.08);
    color: #fff;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
    text-decoration: none;
  }
  .tel-settings-update-icon-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .tel-settings-update-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .tel-settings-update-btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .tel-settings-about-view,
  .tel-settings-report-view {
    display: grid;
    gap: 14px;
  }
  .tel-settings-about-view {
    align-content: start;
  }
  .tel-settings-about-hero {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 16px;
    padding: 8px 2px 2px;
  }
  .tel-settings-about-kicker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    opacity: 0.95;
  }
  .tel-settings-about-kicker .app-icon {
    width: 90px;
    height: 90px;
    color: #fff;
  }
  .tel-settings-about-title {
    margin: 0;
    font-size: 46px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: transparent;
    -webkit-text-stroke: 1px;
    -webkit-text-stroke-color: #fff;
  }
  .tel-settings-about-title:hover {
    color: #ff4d6d;
    -webkit-text-stroke: 1px;
    -webkit-text-stroke-color: transparent;
  }
  .tel-settings-about-status-surface {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.16);
    background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  }
  .tel-settings-about-update-panel {
    display: grid;
    gap: 12px;
  }
  .tel-settings-about-meta,
  .tel-settings-about-update-row,
  .tel-settings-about-links,
  .tel-settings-report-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: center;
  }
  .tel-settings-about-meta {
    justify-content: flex-start;
    align-items: center;
    margin-top: 0;
  }
  .tel-settings-about-version-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tel-settings-about-version-label {
    font-size: 15px;
    font-weight: 600;
  }
  .tel-settings-about-version-badge {
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.1);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    padding: 3px 10px;
    letter-spacing: 0.04em;
  }
  .tel-settings-about-status {
    color: #5fe58b;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-radius: 999px;
    border: 1px solid rgba(95,229,139,0.45);
    background: rgba(95,229,139,0.16);
    padding: 6px 12px;
    white-space: nowrap;
  }
  .tel-settings-about-card {
    display: grid;
    gap: 14px;
  }
  .tel-settings-card-title {
    margin: 0;
    font-size: 18px;
    line-height: 1.3;
  }
  .tel-settings-about-footer,
  .tel-settings-helper-text {
    margin: 0;
    color: rgba(227,231,240,0.78);
    font-size: 13px;
    line-height: 1.5;
    justify-self: center;
  }
  .tel-settings-about-links {
    margin-top: 2px;
  }
  .tel-settings-about-update-row {
    flex-wrap: nowrap;
  }
  .tel-settings-about-update-row .tel-settings-update-btn {
    min-height: 44px;
  }
  .tel-settings-form-input,
  .tel-settings-form-textarea {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(18,23,35,0.82);
    color: #fff;
    padding: 12px 14px;
    font-size: 15px;
    box-sizing: border-box;
  }
  .tel-settings-form-textarea {
    resize: vertical;
    min-height: 150px;
  }
  .tel-settings-report-card {
    display: grid;
    gap: 10px;
  }
  .tel-settings-report-debug {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    margin-top: 4px;
    justify-content: center;
  }
  @media (max-width: 700px) {
    .tel-settings-shell { width: min(96vw, 650px); }
    .tel-settings-sidebar { display: none; }
    .tel-settings-row-title { font-size: 18px; }
    .tel-settings-row-desc { font-size: 13px; }
    .tel-settings-save-btn { font-size: 16px; padding: 10px 16px; }
    .tel-settings-content-row { gap: 10px; }
    .tel-settings-actions-rail { gap: 10px; }
    .tel-settings-close-btn { width: 40px; height: 40px; }
    .tel-settings-action-btn { width: 40px; height: 40px; }
    .tel-settings-about-title { font-size: 34px; }
    .tel-settings-about-kicker .app-icon { width: 64px; height: 64px; }
    .tel-settings-about-status-surface { flex-direction: column; align-items: flex-start; }
    .tel-settings-about-update-row { width: 100%; }
  }
`;
