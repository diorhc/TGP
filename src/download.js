const progressFactory = (() => {
  const t = (key, fallback) => i18n.t(key, fallback);
  let onCancel = () => {};
  let onRetry = () => {};
  let onReorder = () => {};
  let onExportLogs = () => {};
  let isCollapsed = false;

  const getList = (container) => container?.querySelector('[data-role="progress-list"]');

  const syncVisibility = (container) => {
    const list = getList(container);
    if (!list) return;
    list.style.display = isCollapsed ? "none" : "flex";
  };

  const updateSummary = () => {
    const container = document.getElementById(PROGRESS_CONTAINER_ID);
    if (!container) return;
    const countNode = container.querySelector('[data-role="progress-count"]');
    const toggleNode = container.querySelector('[data-role="progress-toggle"]');
    const cards = Array.from(container.querySelectorAll('[id^="tel-downloader-progress-"]'));

    const total = cards.length;
    const inQueue = cards.filter((card) => {
      const status = card.dataset.state || "queued";
      return ["queued", "active", "retrying"].includes(status);
    }).length;

    if (countNode) {
      countNode.textContent = `${inQueue}/${total}`;
    }

    if (toggleNode) {
      toggleNode.textContent = isCollapsed ? "▾" : "▴";
      toggleNode.setAttribute(
        "aria-label",
        isCollapsed
          ? t("progress.expand", "Expand download queue")
          : t("progress.collapse", "Collapse download queue"),
      );
    }

    if (total === 0) {
      container.style.display = "none";
      isCollapsed = false;
      syncVisibility(container);
      if (toggleNode) toggleNode.textContent = "▴";
      return;
    }

    container.style.display = "flex";
    syncVisibility(container);
  };

  const ensureContainer = () => {
    let container = document.getElementById(PROGRESS_CONTAINER_ID);
    if (container) return container;
    container = createElement("div", {
      attributes: {
        id: PROGRESS_CONTAINER_ID,
        role: "region",
        "aria-live": "polite",
        "aria-atomic": "false",
      },
      style: styleFactory.progressContainer(),
    });

    const header = createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "8px 10px",
        borderRadius: "12px",
        ...styleFactory.glassPanel(getTheme()),
      },
    });
    header.setAttribute("data-role", "progress-header");

    const title = createElement("span", {
      text: t("progress.queueTitle", "Downloads"),
      style: {
        fontSize: "13px",
        fontWeight: "700",
      },
    });

    const right = createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
      },
    });
    const count = createElement("span", {
      text: "0/0",
      style: {
        fontSize: "12px",
        fontWeight: "600",
        opacity: "0.85",
      },
      attributes: { "data-role": "progress-count" },
    });
    const exportButton = createElement("button", {
      type: "button",
      text: "CSV",
      attributes: { "data-role": "progress-export" },
      style: {
        border: "none",
        background: "transparent",
        color: getTheme() ? "#eaeaea" : "#111",
        cursor: "pointer",
        fontSize: "11px",
        lineHeight: "1",
        padding: "2px 4px",
        fontWeight: "700",
        display: "none",
      },
      ariaLabel: t("progress.exportLog", "Export download log"),
    });
    const devModeEnabled = (() => {
      try {
        return localStorage.getItem("tel_devmode") === "1";
      } catch {
        return false;
      }
    })();
    exportButton.style.display = devModeEnabled ? "inline-flex" : "none";
    exportButton.addEventListener("click", () => onExportLogs());
    const toggle = createElement("button", {
      type: "button",
      text: "▴",
      attributes: { "data-role": "progress-toggle" },
      style: {
        border: "none",
        background: "transparent",
        color: getTheme() ? "#eaeaea" : "#111",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "1",
        padding: "2px 4px",
      },
      ariaLabel: t("progress.collapse", "Collapse download queue"),
    });
    toggle.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      updateSummary();
    });
    right.append(exportButton, count, toggle);
    header.append(title, right);

    const list = createElement("div", {
      attributes: { "data-role": "progress-list" },
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      },
    });

    container.append(header, list);
    container.style.display = "none";
    appendToRoot(container);
    updateSummary();
    return container;
  };

  const getCard = (taskId) => document.getElementById(`tel-downloader-progress-${taskId}`);

  const createCard = (taskId, fileName) => {
    const isDark = getTheme();
    const card = createElement("div", {
      attributes: { id: `tel-downloader-progress-${taskId}` },
      style: styleFactory.progressCard(isDark),
    });
    card.dataset.taskId = taskId;
    card.draggable = false;

    card.addEventListener("dragstart", (event) => {
      if (card.dataset.state !== "queued") {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", taskId);
      card.style.opacity = "0.6";
    });
    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
    });
    card.addEventListener("dragover", (event) => {
      if (card.dataset.state !== "queued") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (card.dataset.state !== "queued") return;
      const sourceTaskId = event.dataTransfer.getData("text/plain");
      if (!sourceTaskId || sourceTaskId === taskId) return;
      onReorder(sourceTaskId, taskId);
    });

    const top = createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
        marginBottom: "8px",
      },
    });
    const title = createElement("p", {
      className: "filename",
      text: fileName,
      style: {
        margin: "0",
        color: isDark ? "#eaeaea" : "#111",
        fontWeight: "600",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: "1",
      },
    });
    const close = createElement("button", {
      type: "button",
      text: "×",
      ariaLabel: `Cancel download ${fileName}`,
      style: {
        border: "none",
        background: "transparent",
        color: isDark ? "#eaeaea" : "#111",
        cursor: "pointer",
        fontSize: "20px",
        lineHeight: "1",
        padding: "0",
      },
    });
    close.addEventListener("click", () => onCancel(taskId));
    top.append(title, close);

    const bar = createElement("div", {
      className: "progress",
      role: "progressbar",
      ariaLabel: `Downloading ${fileName}`,
      style: styleFactory.progressBar(isDark),
    });
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", "0");

    const label = createElement("p", {
      className: "progress-label",
      text: t("progress.queued", "Queued"),
      style: styleFactory.progressLabel(isDark),
    });
    const fill = createElement("div", {
      className: "progress-fill",
      style: styleFactory.progressFill(
        "linear-gradient(90deg, rgba(96,147,181,1) 0%, rgba(102,201,173,1) 100%)",
      ),
    });
    bar.append(label, fill);

    const message = createElement("div", {
      className: "task-message",
      style: {
        marginTop: "8px",
        fontSize: "12px",
        opacity: "0.8",
        minHeight: "16px",
      },
    });

    card.append(top, bar, message);
    return card;
  };

  const ensureTask = (taskId, fileName) => {
    const container = ensureContainer();
    const list = getList(container);
    let card = getCard(taskId);
    if (!card) {
      card = createCard(taskId, fileName);
      list?.appendChild(card);
      updateSummary();
    }
    return card;
  };

  const updateState = (taskId, updateFn) => {
    const card = getCard(taskId);
    if (!card) return;
    updateFn(card);
    updateSummary();
  };

  const refreshCardTexts = (card) => {
    if (!card) return;
    const label = card.querySelector(".progress-label");
    const message = card.querySelector(".task-message");
    const state = card.dataset.state || "queued";

    if (state === "queued") {
      const queuedLabel = t("progress.queued", "Queued");
      const position = Number(card.dataset.queuePosition || "0");
      if (label) label.textContent = position > 0 ? `${queuedLabel} #${position}` : queuedLabel;
      if (message) {
        message.replaceChildren(
          createElement("span", {
            text: t("progress.waitingSlot", "Waiting for a free slot"),
          }),
        );
      }
      return;
    }

    if (state === "active") {
      if (message) message.textContent = t("progress.downloading", "Downloading");
      return;
    }

    if (state === "retrying") {
      const attempt = card.dataset.retryAttempt || "1";
      const delaySec = card.dataset.retryDelaySec || "1";
      if (label) label.textContent = `${t("progress.retrying", "Retry")} ${attempt}/${MAX_RETRIES}`;
      if (message) {
        message.textContent = `${t("progress.retryingIn", "Retrying in")} ${delaySec}s`;
      }
      return;
    }

    if (state === "completed") {
      if (label) label.textContent = t("progress.completed", "Completed");
      if (message) message.textContent = t("progress.saved", "Saved successfully");
      return;
    }

    if (state === "aborted") {
      if (label) label.textContent = t("progress.aborted", "Aborted");
      if (message) message.textContent = t("progress.cancelledByUser", "Cancelled by user");
      return;
    }

    if (state === "failed") {
      if (label) label.textContent = t("progress.failed", "Failed");
      const retryLink = message?.querySelector("button");
      if (retryLink) retryLink.textContent = t("progress.retryButton", "Retry");
    }
  };

  const setQueued = (taskId, fileName, position) => {
    ensureTask(taskId, fileName);
    updateState(taskId, (card) => {
      card.dataset.state = "queued";
      card.dataset.queuePosition = String(position || 0);
      delete card.dataset.retryAttempt;
      delete card.dataset.retryDelaySec;
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      const title = card.querySelector(".filename");
      card.draggable = true;
      if (title) title.textContent = fileName;
      if (label) {
        const queuedLabel = t("progress.queued", "Queued");
        label.textContent = position > 0 ? `${queuedLabel} #${position}` : queuedLabel;
      }
      if (fill) {
        fill.style.width = "100%";
        fill.style.background = "linear-gradient(90deg, #b0bec5 0%, #cfd8dc 100%)";
      }
      if (message) {
        message.replaceChildren(
          createElement("span", {
            text: t("progress.waitingSlot", "Waiting for a free slot"),
          }),
        );
      }
    });
  };

  const setActive = (taskId, fileName) => {
    ensureTask(taskId, fileName);
    updateState(taskId, (card) => {
      card.dataset.state = "active";
      card.dataset.queuePosition = "0";
      delete card.dataset.retryAttempt;
      delete card.dataset.retryDelaySec;
      const title = card.querySelector(".filename");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      card.draggable = false;
      if (title) title.textContent = fileName;
      if (fill) {
        fill.style.width = "0%";
        fill.style.background =
          "linear-gradient(90deg, rgba(96,147,181,1) 0%, rgba(102,201,173,1) 100%)";
      }
      if (message) message.textContent = t("progress.downloading", "Downloading");
    });
  };

  const update = (taskId, fileName, percent, speedText = "") => {
    updateState(taskId, (card) => {
      const title = card.querySelector(".filename");
      const bar = card.querySelector(".progress");
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      if (title) title.textContent = fileName;
      if (label) label.textContent = `${percent}%${speedText}`;
      if (fill) fill.style.width = `${percent}%`;
      if (bar) {
        bar.setAttribute("aria-valuenow", String(percent));
        if (speedText) bar.setAttribute("aria-valuetext", `${percent}% ${speedText}`);
      }
      if (message) message.textContent = t("progress.downloading", "Downloading");
    });
  };

  const setRetrying = (taskId, fileName, attempt, delay) => {
    updateState(taskId, (card) => {
      card.dataset.state = "retrying";
      card.dataset.retryAttempt = String(attempt || 1);
      card.dataset.retryDelaySec = String(Math.ceil(delay / 1000));
      const title = card.querySelector(".filename");
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      card.draggable = false;
      if (title) title.textContent = fileName;
      if (label) {
        label.textContent = `${t("progress.retrying", "Retry")} ${attempt}/${MAX_RETRIES}`;
      }
      if (fill) {
        fill.style.width = "100%";
        fill.style.background = "linear-gradient(90deg, #ffb74d 0%, #ffa726 100%)";
      }
      if (message) {
        message.textContent = `${t("progress.retryingIn", "Retrying in")} ${Math.ceil(delay / 1000)}s`;
      }
    });
  };

  const setCompleted = (taskId) => {
    updateState(taskId, (card) => {
      card.dataset.state = "completed";
      delete card.dataset.retryAttempt;
      delete card.dataset.retryDelaySec;
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      card.draggable = false;
      if (label) label.textContent = t("progress.completed", "Completed");
      if (fill) {
        fill.style.width = "100%";
        fill.style.background = "#B6C649";
      }
      if (message) message.textContent = t("progress.saved", "Saved successfully");
      setTimeout(() => {
        card.remove();
        updateSummary();
      }, 5000);
    });
  };

  const setAborted = (taskId) => {
    updateState(taskId, (card) => {
      card.dataset.state = "aborted";
      delete card.dataset.retryAttempt;
      delete card.dataset.retryDelaySec;
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      card.draggable = false;
      if (label) label.textContent = t("progress.aborted", "Aborted");
      if (fill) {
        fill.style.width = "100%";
        fill.style.background = "#D16666";
      }
      if (message) message.textContent = t("progress.cancelledByUser", "Cancelled by user");
      setTimeout(() => {
        card.remove();
        updateSummary();
      }, 6000);
    });
  };

  const setFailed = (taskId, errorMessage) => {
    updateState(taskId, (card) => {
      card.dataset.state = "failed";
      delete card.dataset.retryAttempt;
      delete card.dataset.retryDelaySec;
      const label = card.querySelector(".progress-label");
      const fill = card.querySelector(".progress-fill");
      const message = card.querySelector(".task-message");
      card.draggable = true;
      if (label) label.textContent = t("progress.failed", "Failed");
      if (fill) {
        fill.style.width = "100%";
        fill.style.background = "#D16666";
      }
      if (message) {
        const retryLink = createElement("button", {
          type: "button",
          text: t("progress.retryButton", "Retry"),
          style: {
            border: "none",
            background: "transparent",
            color: "#2196F3",
            cursor: "pointer",
            padding: "0",
            marginLeft: "6px",
          },
        });
        retryLink.addEventListener("click", () => onRetry(taskId));
        message.replaceChildren(
          createElement("span", {
            text: errorMessage || "Download failed",
          }),
          retryLink,
        );
      }
    });
  };

  return {
    configure({ cancelHandler, retryHandler, reorderHandler, exportLogsHandler }) {
      onCancel = cancelHandler;
      onRetry = retryHandler;
      onReorder = reorderHandler || (() => {});
      onExportLogs = exportLogsHandler || (() => {});
    },
    ensureContainer,
    ensureTask,
    setQueued,
    setActive,
    update,
    setRetrying,
    setCompleted,
    setAborted,
    setFailed,
    refreshTexts() {
      const container = ensureContainer();
      container
        .querySelectorAll('[id^="tel-downloader-progress-"]')
        .forEach((card) => refreshCardTexts(card));
      updateSummary();
    },
    refreshTheme() {
      const container = document.getElementById(PROGRESS_CONTAINER_ID);
      if (!container) return;

      const header = container.querySelector('[data-role="progress-header"]');
      if (header) {
        applyStyles(header, styleFactory.glassPanel(getTheme()));
      }

      const toggle = container.querySelector('[data-role="progress-toggle"]');
      if (toggle instanceof HTMLElement) {
        toggle.style.color = getTheme() ? "#eaeaea" : "#111";
      }
      const exportButton = container.querySelector('[data-role="progress-export"]');
      if (exportButton instanceof HTMLElement) {
        exportButton.style.color = getTheme() ? "#eaeaea" : "#111";
      }

      container.querySelectorAll('[id^="tel-downloader-progress-"]').forEach((card) => {
        applyStyles(card, styleFactory.progressCard(getTheme()));
        const title = card.querySelector(".filename");
        const close = card.querySelector("button");
        const label = card.querySelector(".progress-label");
        const bar = card.querySelector(".progress");

        if (title instanceof HTMLElement) {
          title.style.color = getTheme() ? "#eaeaea" : "#111";
        }
        if (close instanceof HTMLElement) {
          close.style.color = getTheme() ? "#eaeaea" : "#111";
        }
        if (label instanceof HTMLElement) {
          label.style.color = getTheme() ? "#fff" : "#111";
        }
        if (bar instanceof HTMLElement) {
          applyStyles(bar, styleFactory.progressBar(getTheme()));
        }
      });

      const exportButtonNode = container.querySelector('[data-role="progress-export"]');
      if (exportButtonNode instanceof HTMLElement) {
        const devMode = (() => {
          try {
            return localStorage.getItem("tel_devmode") === "1";
          } catch {
            return false;
          }
        })();
        exportButtonNode.style.display = devMode ? "inline-flex" : "none";
      }
    },
  };
})();

const showNotification = (message, type = "info", duration = 3000) => {
  notificationFactory.show(message, type, duration);
};

const showNotificationIfEnabled = (message, type = "info", duration = 3000) => {
  if (type === "error" || state.settings.enableNotifications) {
    showNotification(message, type, duration);
  }
};

const downloadCompatibility = (() => {
  const anchorSupportsDownload = () => "download" in HTMLAnchorElement.prototype;
  const canUseGmDownload = () => typeof GM_download === "function";

  const saveWithGmDownload = (url, fileName, shouldPrompt = false) => {
    if (!canUseGmDownload()) return Promise.resolve(false);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const fail = (errorLike) => {
        if (settled) return;
        settled = true;
        const message =
          errorLike?.error || errorLike?.details || errorLike?.message || "GM_download failed";
        reject(new Error(String(message)));
      };

      try {
        const request = GM_download({
          url,
          name: fileName,
          saveAs: Boolean(shouldPrompt),
          onload: () => finish(true),
          onerror: fail,
          ontimeout: fail,
          onabort: fail,
        });

        // Some managers return no callbacks for blocked protocols; keep a guard.
        if (!request && !shouldPrompt) {
          setTimeout(() => finish(false), 500);
        }
      } catch (error) {
        fail(error);
      }
    });
  };

  const getPickerFunction = () => {
    if (!PAGE_WINDOW || typeof PAGE_WINDOW.showSaveFilePicker !== "function") return null;
    return PAGE_WINDOW.showSaveFilePicker.bind(PAGE_WINDOW);
  };

  const canUseFileSystemPicker = () => {
    if (!getPickerFunction()) return false;
    try {
      return PAGE_WINDOW.self === PAGE_WINDOW.top;
    } catch {
      return false;
    }
  };

  const canUseSavePromptDialog = () => canUseFileSystemPicker() || canUseGmDownload();

  // 'gm-picker' = no native showSaveFilePicker (Firefox/Safari), but the userscript
  // manager exposes GM_download with saveAs:true, which surfaces the OS "Save As" dialog.
  const resolveStrategy = (preferred = state.settings.downloadLocation) => {
    const normalizedPreference = preferred;
    switch (normalizedPreference) {
      case "picker":
        if (canUseFileSystemPicker()) return "picker";
        if (canUseGmDownload()) return "gm-picker";
        return anchorSupportsDownload() ? "browser" : "tab";
      case "tab":
        return "tab";
      case "auto":
        if (canUseFileSystemPicker()) return "picker";
        if (IS_SAFARI) return "tab";
        if (anchorSupportsDownload()) return "browser";
        return IS_SAFARI ? "browser" : "tab";
      case "browser":
      default:
        return IS_SAFARI ? "tab" : anchorSupportsDownload() ? "browser" : "tab";
    }
  };

  const saveWithPicker = async (blob, fileName) => {
    const showPicker = getPickerFunction();
    if (!showPicker) throw new Error("File picker is not available");
    const handle = await showPicker({
      suggestedName: fileName,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const openStreamingPicker = (suggestedName) => {
    const showPicker = getPickerFunction();
    if (!showPicker) return Promise.resolve(null);
    return showPicker({ suggestedName }).then((handle) => handle.createWritable());
  };

  // Strategy contract:
  //   "picker"    -> always surface a Save As dialog (native FSA).
  //   "gm-picker" -> Save As dialog via GM_download({ saveAs: true }) when the
  //                  manager supports it; if it silently no-ops, we open the
  //                  blob in a new tab so the browser shows its own download UI.
  //   "browser"   -> silent download to the browser's default folder via
  //                  <a download>. Must NOT route through GM_download because
  //                  some managers (notably Tampermonkey on Chrome with default
  //                  settings) always prompt regardless of saveAs:false, which
  //                  breaks the "default folder" guarantee.
  //   "tab"       -> open the resource in a new tab.
  const saveBlob = async (blob, fileName, preferredStrategy) => {
    const strategy = resolveStrategy(preferredStrategy);

    if (strategy === "picker") {
      try {
        await saveWithPicker(blob, fileName);
        return "picker";
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        logger.warn(`Native picker failed, falling back: ${err.message}`);
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    try {
      if (strategy === "gm-picker" && canUseGmDownload()) {
        try {
          const savedViaGm = await saveWithGmDownload(blobUrl, fileName, true);
          if (savedViaGm) return "gm-picker";
          logger.warn(
            "GM_download(saveAs:true) did not surface a dialog; opening blob in a new tab.",
          );
          if (openInNewTab(blobUrl)) return "tab";
        } catch (err) {
          if (err?.message?.toLowerCase().includes("abort")) throw err;
          logger.warn(`GM_download(saveAs:true) failed: ${err.message}`);
        }
      }

      const normalized = strategy === "gm-picker" ? "browser" : strategy;
      const fallbackStrategy = IS_SAFARI && normalized !== "picker" ? "tab" : normalized;
      return openWithFallback(
        blobUrl,
        fallbackStrategy === "tab" ? undefined : fileName,
        fallbackStrategy === "tab" ? "tab" : "browser",
      );
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), IS_SAFARI ? 30000 : 6000);
    }
  };

  const saveUrl = async (url, fileName, preferredStrategy) => {
    const strategy = resolveStrategy(preferredStrategy);

    if (strategy === "picker") {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
      const blob = await response.blob();
      await saveWithPicker(blob, fileName);
      return "picker";
    }

    if (strategy === "gm-picker" && canUseGmDownload()) {
      try {
        const savedViaGm = await saveWithGmDownload(url, fileName, true);
        if (savedViaGm) return "gm-picker";
        logger.warn("GM_download(saveAs:true) did not surface a dialog; opening URL in a new tab.");
        if (openInNewTab(url)) return "tab";
      } catch (err) {
        if (err?.message?.toLowerCase().includes("abort")) throw err;
        logger.warn(`GM_download(saveAs:true) failed: ${err.message}`);
      }
    }

    const finalStrategy = strategy === "gm-picker" ? "browser" : strategy;
    return openWithFallback(url, finalStrategy === "browser" ? fileName : undefined, finalStrategy);
  };

  return {
    saveBlob,
    saveUrl,
    resolveStrategy,
    acquireWritable: (suggestedName) => {
      if (resolveStrategy() !== "picker") return Promise.resolve(null);
      if (!canUseFileSystemPicker()) return Promise.resolve(null);
      return openStreamingPicker(suggestedName).catch((err) => {
        if (err?.name === "AbortError") throw err;
        logger.warn(`Picker open failed, falling back: ${err.message}`);
        return null;
      });
    },
    canUseStreamingPicker: () => resolveStrategy() === "picker" && canUseFileSystemPicker(),
    isPickerSupported: () => canUseFileSystemPicker(),
    isSavePromptSupported: () => canUseSavePromptDialog(),
  };
})();

const queueManager = (() => {
  const tasks = new Map();
  const pending = [];
  const active = new Set();
  const eventLog = [];
  const MAX_LOG_ENTRIES = 500;

  const pushEventLog = (event, task, details = "") => {
    eventLog.push({
      at: new Date().toISOString(),
      event,
      taskId: task?.id || "",
      fileName: task?.fileName || "",
      mediaKind: task?.mediaKind || "",
      details,
    });
    if (eventLog.length > MAX_LOG_ENTRIES) {
      eventLog.splice(0, eventLog.length - MAX_LOG_ENTRIES);
    }
  };

  const exportLogsCsv = () => {
    if (eventLog.length === 0) {
      showNotification(i18n.t("progress.noLog", "No download events yet"), "info");
      return;
    }

    const escapeCsv = (value) => `"${String(value || "").replace(/"/g, '""')}"`;
    const rows = [
      ["at", "event", "taskId", "fileName", "mediaKind", "details"],
      ...eventLog.map((entry) => [
        entry.at,
        entry.event,
        entry.taskId,
        entry.fileName,
        entry.mediaKind,
        entry.details,
      ]),
    ];
    const csv = `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      triggerAnchorDownload(blobUrl, `telegram-plus-download-log-${stamp}.csv`);
      showNotification(i18n.t("progress.logExported", "Download log exported"), "success");
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    }
  };

  const hasRetryTimers = () => Array.from(tasks.values()).some((task) => Boolean(task?.retryTimer));

  const getDiagnosticsSnapshot = () => {
    const statusCounts = Array.from(tasks.values()).reduce((acc, task) => {
      const status = task?.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      pendingCount: pending.length,
      activeCount: active.size,
      totalTasks: tasks.size,
      maxActiveDownloads: MAX_ACTIVE_DOWNLOADS,
      statusCounts,
      recentEvents: eventLog.slice(-20),
    };
  };

  const isQueueIdle = () => active.size === 0 && pending.length === 0 && !hasRetryTimers();

  const updateQueuedPositions = () => {
    pending.forEach((task, index) => {
      progressFactory.setQueued(task.id, task.fileName, index + 1);
    });
  };

  const reorder = (sourceTaskId, targetTaskId) => {
    const sourceIndex = pending.findIndex((task) => task.id === sourceTaskId);
    const targetIndex = pending.findIndex((task) => task.id === targetTaskId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const [moved] = pending.splice(sourceIndex, 1);
    pending.splice(targetIndex, 0, moved);
    pushEventLog("reordered", moved, `before:${targetTaskId}`);
    updateQueuedPositions();
  };

  const finalizeTask = (task, removeTask = false) => {
    active.delete(task.id);
    updateQueuedPositions();
    processQueue();
    if (removeTask) {
      if (task.retryTimer) {
        clearTimeout(task.retryTimer);
        task.retryTimer = null;
      }
      tasks.delete(task.id);
    }
  };

  const scheduleRetry = (task, error) => {
    const retryPlan = getRetryPlan({
      retryCount: task.retryCount,
      error,
      maxRetries: MAX_RETRIES,
      baseDelay: RETRY_DELAY_BASE,
    });
    task.retryCount = retryPlan.retryCount;

    if (retryPlan.action === "fail") {
      task.status = "failed";
      pushEventLog("failed", task, error?.message || "retry exhausted");
      progressFactory.setFailed(
        task.id,
        error.message || i18n.t("notification.downloadFailed", "Download failed"),
      );
      showNotificationIfEnabled(
        `${i18n.t("notification.downloadFailed", "Download failed")}: ${task.fileName}`,
        "error",
      );
      finalizeTask(task);
      return;
    }

    const delay = retryPlan.delay;
    task.status = "retrying";
    pushEventLog("retrying", task, `attempt:${task.retryCount} delayMs:${delay}`);
    progressFactory.setRetrying(task.id, task.fileName, task.retryCount, delay);
    finalizeTask(task);
    task.retryTimer = setTimeout(() => {
      task.retryTimer = null;
      task.status = "queued";
      pending.unshift(task);
      updateQueuedPositions();
      processQueue();
    }, delay);
  };

  const processQueue = () => {
    if (pending.length === 0) return;

    const activationIndexes = getQueueActivationIndexes({
      pendingStatuses: pending.map((task) => task.status),
      activeCount: active.size,
      maxActive: MAX_ACTIVE_DOWNLOADS,
    });

    if (activationIndexes.length === 0) return;

    const tasksToStart = [];
    for (let index = activationIndexes.length - 1; index >= 0; index -= 1) {
      const pendingIndex = activationIndexes[index];
      const [task] = pending.splice(pendingIndex, 1);
      if (task) tasksToStart.unshift(task);
    }

    tasksToStart.forEach((task) => {
      if (!task || task.status !== "queued") return;

      active.add(task.id);
      task.status = "active";
      pushEventLog("started", task);
      task.abortController = new AbortController();
      progressFactory.setActive(task.id, task.fileName);
      updateQueuedPositions();

      task
        .execute(task)
        .then(() => {
          task.status = "completed";
          pushEventLog("completed", task);
          progressFactory.setCompleted(task.id);
          finalizeTask(task, true);
          if (isQueueIdle()) {
            showNotificationIfEnabled(
              `${i18n.t("notification.downloadCompleted", "Download completed")}: ${task.fileName}`,
              "success",
            );
          }
        })
        .catch((error) => {
          if (error?.name === "AbortError" || task.status === "aborted") {
            task.status = "aborted";
            pushEventLog("aborted", task, "abort signal");
            progressFactory.setAborted(task.id);
            finalizeTask(task, true);
            return;
          }

          logger.error(error.message || String(error), task.fileName);
          scheduleRetry(task, error);
        });
    });
  };

  const enqueue = (task) => {
    task.retryCount = task.retryCount || 0;
    task.status = "queued";
    pushEventLog("queued", task);
    tasks.set(task.id, task);
    progressFactory.ensureTask(task.id, task.fileName);
    pending.push(task);
    updateQueuedPositions();
    processQueue();
    return task.id;
  };

  const cancel = (taskId) => {
    const task = tasks.get(taskId);
    if (!task) return;

    if (task.retryTimer) {
      clearTimeout(task.retryTimer);
      task.retryTimer = null;
    }

    const pendingIndex = pending.findIndex((item) => item.id === taskId);
    const cancelPlan = getCancelPlan({
      inPendingQueue: pendingIndex >= 0,
      hasAbortController: Boolean(task.abortController),
    });

    if (cancelPlan === "remove-pending") {
      pending.splice(pendingIndex, 1);
      task.status = "aborted";
      pushEventLog("aborted", task, "cancelled while queued");
      progressFactory.setAborted(task.id);
      task.clearResume?.();
      tasks.delete(task.id);
      updateQueuedPositions();
      return;
    }

    if (cancelPlan === "abort-active") {
      task.status = "aborted";
      pushEventLog("aborted", task, "cancelled while active");
      task.clearResume?.();
      task.abortController.abort();
    }
  };

  const retry = (taskId) => {
    const task = tasks.get(taskId);
    if (!task) return;
    if (!canManualRetry(task.status)) return;
    if (task.retryTimer) {
      clearTimeout(task.retryTimer);
      task.retryTimer = null;
    }
    task.retryCount = 0;
    task.status = "queued";
    pushEventLog("manual-retry", task);
    pending.unshift(task);
    updateQueuedPositions();
    processQueue();
  };

  progressFactory.configure({
    cancelHandler: cancel,
    retryHandler: retry,
    reorderHandler: reorder,
    exportLogsHandler: exportLogsCsv,
  });

  return {
    enqueue,
    cancel,
    retry,
    isIdle: isQueueIdle,
    exportLogsCsv,
    getDiagnosticsSnapshot,
  };
})();

const downloadsModule = (() => {
  const normalizeDownloadUrl = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return null;

    // Telegram WebK feeds full-resolution images and stickers as blob: URLs
    // backed by an in-memory Blob, and inline previews can use data: URIs.
    // Both are safe to fetch() and stream into the download pipeline.
    if (/^(?:blob:|data:)/i.test(raw)) {
      return raw;
    }

    try {
      const parsed = new URL(raw, location.href);
      const path = parsed.pathname || "/";
      const looksLikePageRoot =
        parsed.origin === location.origin &&
        (path === "/" || path === "/k" || path === "/k/" || path === "/z" || path === "/z/");

      if (looksLikePageRoot) return null;
      if (!/^https?:$/.test(parsed.protocol)) return null;

      return parsed.href;
    } catch {
      return null;
    }
  };

  const requireDownloadUrl = (url, mediaKind) => {
    const normalizedUrl = normalizeDownloadUrl(url);
    if (!normalizedUrl) {
      throw new Error(`Invalid ${mediaKind} URL`);
    }

    if (/^blob:/i.test(normalizedUrl) && (mediaKind === "video" || mediaKind === "audio")) {
      throw new Error(
        i18n.t(
          "notification.streamBlobUnsupported",
          "This media is streamed via blob URL. Full download is not available in this browser.",
        ),
      );
    }

    return normalizedUrl;
  };

  const resumeStorage = (() => {
    const DB_NAME = "tel_downloader_resume";
    const STORE_NAME = "chunks";
    const DB_VERSION = 1;
    const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
    const RESUME_MAX_RECORDS = 50;
    let dbPromise = null;
    let prunePromise = null;

    const isSupported = () => typeof indexedDB !== "undefined";

    const openDb = () => {
      if (!isSupported()) return Promise.resolve(null);
      if (dbPromise) return dbPromise;

      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Failed to open resume DB"));
      }).catch((error) => {
        logger.warn(`Resume DB unavailable: ${error.message}`);
        return null;
      });

      return dbPromise;
    };

    const withStore = async (mode, work) => {
      const db = await openDb();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let request;
        try {
          request = work(store);
        } catch (error) {
          reject(error);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Resume DB request failed"));
      }).catch((error) => {
        logger.warn(`Resume DB operation failed: ${error.message}`);
        return null;
      });
    };

    const updatedAtMs = (record) => Number(record?.updatedAt || 0);
    const isFreshRecord = (record, now) => now - updatedAtMs(record) <= RESUME_TTL_MS;
    const byUpdatedAtDesc = (left, right) => updatedAtMs(right) - updatedAtMs(left);
    const hasResumeKey = (record) => Boolean(record?.key);
    const hasResumeIdentity = (record) =>
      hasResumeKey(record) && Boolean(record?.url) && Boolean(record?.mediaKind);
    const normalizeRecordForSave = (record) => ({
      ...record,
      updatedAt: Number(record?.updatedAt || Date.now()),
    });

    const prune = async () => {
      if (prunePromise) return prunePromise;

      prunePromise = (async () => {
        const records = await withStore("readonly", (store) => store.getAll());
        if (!Array.isArray(records) || records.length === 0) return;

        const now = Date.now();
        const staleKeys = records
          .filter((record) => !isFreshRecord(record, now))
          .map((record) => record.key)
          .filter(Boolean);

        for (const key of staleKeys) {
          await withStore("readwrite", (store) => store.delete(key));
        }

        const freshRecords = records
          .filter((record) => hasResumeKey(record) && isFreshRecord(record, now))
          .sort(byUpdatedAtDesc);

        if (freshRecords.length > RESUME_MAX_RECORDS) {
          const extra = freshRecords.slice(RESUME_MAX_RECORDS);
          for (const record of extra) {
            await withStore("readwrite", (store) => store.delete(record.key));
          }
        }
      })().finally(() => {
        prunePromise = null;
      });

      return prunePromise;
    };

    return {
      async load(key) {
        if (!key) return null;
        const record = await withStore("readonly", (store) => store.get(key));
        if (!record) return null;

        const now = Date.now();
        if (!isFreshRecord(record, now)) {
          await withStore("readwrite", (store) => store.delete(key));
          return null;
        }

        return record;
      },
      async save(record) {
        if (!hasResumeKey(record)) return;
        await withStore("readwrite", (store) => store.put(normalizeRecordForSave(record)));
        void prune();
      },
      async remove(key) {
        if (!key) return;
        await withStore("readwrite", (store) => store.delete(key));
      },
      async list() {
        const records = await withStore("readonly", (store) => store.getAll());
        if (!Array.isArray(records)) return [];

        const now = Date.now();
        return records
          .filter((record) => hasResumeIdentity(record) && isFreshRecord(record, now))
          .sort(byUpdatedAtDesc);
      },
    };
  })();

  const mediaDefaults = {
    video: {
      defaultExtension: "mp4",
      fallbackMime: "video/mp4",
      idPrefix: "video",
    },
    audio: {
      defaultExtension: "ogg",
      fallbackMime: "audio/ogg",
      idPrefix: "audio",
    },
    image: {
      defaultExtension: "jpg",
      fallbackMime: "image/jpeg",
      idPrefix: "image",
    },
    gif: {
      defaultExtension: "gif",
      fallbackMime: "image/gif",
      idPrefix: "gif",
    },
    sticker: {
      defaultExtension: "webp",
      fallbackMime: "image/webp",
      idPrefix: "sticker",
    },
  };

  const accelerateDownloadResponse = async (res) => {
    if (!res || !res.ok || !res.body) return res;
    const contentType = res.headers.get("Content-Type") || "";
    const contentLength = Number(res.headers.get("Content-Length"));
    const shouldBuffer =
      (/^video\//.test(contentType) ||
        /^audio\//.test(contentType) ||
        contentType === "application/octet-stream") &&
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      contentLength <= EAGER_DOWNLOAD_LIMIT;

    if (!shouldBuffer) return res;

    const blob = await res.blob();
    const headers = new Headers();
    res.headers.forEach((value, key) => headers.append(key, value));
    return new Response(blob, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };

  const fetchDownloadPart = (url, offset, signal) =>
    fetch(url, {
      method: "GET",
      headers: { Range: `bytes=${offset}-` },
      signal,
    }).then(accelerateDownloadResponse);

  const assertExpectedMimeType = (contentType, mediaKind, label = "MIME type") => {
    if (!isValidMimeType(contentType, mediaKind)) {
      throw new Error(`Unexpected ${label}: ${contentType.split(";")[0]}`);
    }
  };

  const abortWritableSafely = async (writableHandle) => {
    if (!writableHandle) return;
    try {
      await writableHandle.abort();
    } catch {}
  };

  const executeQueuedDownload = async (task) => {
    const writable = task.writable || null;
    task.writable = null;

    if (!writable && !task.resumeState && task.resumeKey) {
      const persisted = await resumeStorage.load(task.resumeKey);
      if (persisted && persisted.url === task.url && persisted.mediaKind === task.mediaKind) {
        task.resumeState = {
          nextOffset: persisted.nextOffset,
          totalSize: persisted.totalSize,
          chunks: Array.isArray(persisted.chunks) ? persisted.chunks : [],
        };
        if (persisted.fileName) {
          task.fileName = persisted.fileName;
        }
      }
    }

    const resumeState =
      !writable && task.resumeState
        ? task.resumeState
        : { nextOffset: 0, totalSize: null, chunks: [] };

    let nextOffset = Number(resumeState.nextOffset) || 0;
    let totalSize = Number.isFinite(resumeState.totalSize) ? resumeState.totalSize : null;
    let lastUpdateTime = Date.now();
    let lastBytes = nextOffset;
    const blobs = writable ? null : Array.isArray(resumeState.chunks) ? resumeState.chunks : [];
    let currentFileName = task.fileName;

    const persistResumeState = async () => {
      if (writable) return;
      task.resumeState = {
        nextOffset,
        totalSize,
        chunks: blobs,
      };
      await resumeStorage.save({
        key: task.resumeKey,
        url: task.url,
        mediaKind: task.mediaKind,
        fileName: task.fileName,
        nextOffset,
        totalSize,
        chunks: blobs,
        updatedAt: Date.now(),
      });
    };

    const chunkLoop = async () => {
      while (true) {
        const response = await fetchDownloadPart(task.url, nextOffset, task.abortController.signal);
        if (![200, 206].includes(response.status)) {
          throw new Error(`Unexpected response: ${response.status}`);
        }

        const contentType = response.headers.get("Content-Type");
        if (!contentType) throw new Error("Missing Content-Type header");
        assertExpectedMimeType(contentType, task.mediaKind);

        const extension = getExtensionFromMime(contentType, task.defaultExtension);
        currentFileName = currentFileName.replace(/\.\w+$/, `.${extension}`);
        task.fileName = currentFileName;

        const blob = await response.blob();
        const contentRange = response.headers.get("Content-Range");
        if (contentRange) {
          const match = contentRange.match(contentRangeRegex);
          if (!match) throw new Error("Invalid Content-Range header");
          const start = Number(match[1]);
          const end = Number(match[2]);
          const size = Number(match[3]);
          if (start !== nextOffset) throw new Error("Chunk offset mismatch");
          if (totalSize && size !== totalSize) throw new Error("File size changed");
          nextOffset = end + 1;
          totalSize = size;
        } else if (response.status === 200) {
          const contentLength = Number(response.headers.get("Content-Length"));
          totalSize =
            Number.isFinite(contentLength) && contentLength > 0 ? contentLength : blob.size;
          if (nextOffset > 0 && blobs) blobs.length = 0;
          nextOffset = blob.size;
        } else {
          throw new Error("Missing Content-Range header");
        }

        const now = Date.now();
        const timeDiff = (now - lastUpdateTime) / 1000;
        if (timeDiff > 0) {
          const bytesDiff = nextOffset - lastBytes;
          lastBytes = nextOffset;
          lastUpdateTime = now;
          const speedMBNum = bytesDiff / timeDiff / (1024 * 1024);
          const speedMB = speedMBNum.toFixed(2);
          const percent = totalSize ? Number(((nextOffset * 100) / totalSize).toFixed(0)) : 0;
          progressFactory.update(
            task.id,
            currentFileName,
            percent,
            speedMBNum > 0 ? ` (${speedMB} MB/s)` : "",
          );
        }

        if (writable) {
          await writable.write(blob);
        } else {
          blobs.push(blob);
          await persistResumeState();
        }

        if (nextOffset >= totalSize) break;
      }
    };

    try {
      await chunkLoop();
      if (writable) {
        await writable.close();
        logger.info("Saved using strategy: picker (streaming)", currentFileName);
      } else {
        const strategy = await downloadCompatibility.saveBlob(
          new Blob(blobs, { type: task.fallbackMime }),
          currentFileName,
          state.settings.downloadLocation,
        );
        logger.info(`Saved using strategy: ${strategy}`, currentFileName);
      }
      task.resumeState = null;
      await resumeStorage.remove(task.resumeKey);
    } catch (err) {
      await abortWritableSafely(writable);
      throw err;
    }
  };

  const createQueueTask = ({ url, mediaKind, defaultExtension, fallbackMime, idPrefix }) => ({
    id: randomId(idPrefix),
    resumeKey: `${idPrefix}:${hashCode(url).toString(36)}`,
    url,
    mediaKind,
    defaultExtension,
    fallbackMime,
    fileName: extractFileName(url, defaultExtension),
    retryCount: 0,
    abortController: null,
    retryTimer: null,
    writable: null,
    resumeState: null,
    clearResume() {
      this.resumeState = null;
      void resumeStorage.remove(this.resumeKey);
    },
    execute: executeQueuedDownload,
  });

  const restorePendingDownloads = async () => {
    const records = await resumeStorage.list();
    if (records.length === 0) return;

    const promptTemplate = i18n.t(
      "progress.resumePrompt",
      "Found {count} unfinished download(s). Resume now?",
    );
    const promptText = String(promptTemplate).replace("{count}", String(records.length));
    const shouldRestore = window.confirm(promptText);
    if (!shouldRestore) return;

    records.forEach((record) => {
      const defaults = mediaDefaults[record.mediaKind] || mediaDefaults.video;
      const task = createQueueTask({
        url: record.url,
        mediaKind: record.mediaKind,
        defaultExtension: defaults.defaultExtension,
        fallbackMime: defaults.fallbackMime,
        idPrefix: defaults.idPrefix,
      });

      task.resumeKey = record.key;
      task.fileName = record.fileName || task.fileName;
      task.resumeState = {
        nextOffset: Number(record.nextOffset || 0),
        totalSize: Number.isFinite(record.totalSize) ? record.totalSize : null,
        chunks: Array.isArray(record.chunks) ? record.chunks : [],
      };

      queueManager.enqueue(task);
    });
  };

  const enqueueWithPicker = (task) => {
    const writablePromise = downloadCompatibility.acquireWritable(task.fileName);
    writablePromise
      .then((writable) => {
        task.writable = writable;
        queueManager.enqueue(task);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          logger.info("Picker cancelled by user", task.fileName);
          return;
        }
        logger.error(err.message || String(err), task.fileName);
        queueManager.enqueue(task);
      });
  };

  const createSingleVisualTask = ({
    url,
    idPrefix,
    defaultExtension,
    fallbackMime,
    expectedKind = "image",
  }) => ({
    id: randomId(idPrefix),
    url,
    mediaKind: expectedKind,
    defaultExtension,
    fallbackMime,
    fileName: extractFileName(url, defaultExtension),
    retryCount: 0,
    abortController: null,
    retryTimer: null,
    writable: null,
    resumeState: null,
    clearResume() {
      this.resumeState = null;
    },
    async execute(task) {
      const response = await fetch(task.url, {
        signal: task.abortController.signal,
      });
      if (!response.ok) {
        throw new Error(`${idPrefix} response: ${response.status}`);
      }
      const contentType = response.headers.get("Content-Type") || fallbackMime;
      assertExpectedMimeType(contentType, expectedKind, `${idPrefix} MIME type`);
      task.fileName = task.fileName.replace(
        /\.\w+$/,
        `.${getExtensionFromMime(contentType, defaultExtension)}`,
      );
      const blob = await response.blob();
      if (task.writable) {
        try {
          await task.writable.write(blob);
          await task.writable.close();
          logger.info("Saved using strategy: picker", task.fileName);
          return;
        } catch (err) {
          await abortWritableSafely(task.writable);
          task.writable = null;
          if (err?.name === "AbortError") throw err;
          logger.warn(`Picker write failed, using fallback: ${err.message}`);
        }
      }
      const strategy = await downloadCompatibility.saveBlob(
        blob,
        task.fileName,
        state.settings.downloadLocation,
      );
      logger.info(`Saved using strategy: ${strategy}`, task.fileName);
    },
  });

  const getCaptureStreamFunction = (videoElement) => {
    if (videoElement && typeof videoElement.captureStream === "function") {
      return () => videoElement.captureStream();
    }
    if (videoElement && typeof videoElement.mozCaptureStream === "function") {
      return () => videoElement.mozCaptureStream();
    }
    return null;
  };

  const pickRecorderMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";

    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
  };

  const captureStreamedVideo = async (videoElement, options = {}) => {
    if (!(videoElement instanceof HTMLVideoElement)) return false;
    if (typeof MediaRecorder === "undefined") return false;

    const getStream = getCaptureStreamFunction(videoElement);
    if (!getStream) return false;

    let stream;
    try {
      stream = getStream();
    } catch {
      return false;
    }
    if (!stream) return false;

    const stopTracks = () => {
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {}
    };

    const mimeType = pickRecorderMimeType();
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stopTracks();
      return false;
    }

    const maxDurationMs = Math.min(Math.max(Number(options.maxDurationMs || 12000), 3000), 30000);
    const chunks = [];

    return new Promise((resolve) => {
      let timeoutId = null;

      const finalize = async () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (chunks.length === 0) {
          stopTracks();
          resolve(false);
          return;
        }

        try {
          const outputType = recorder.mimeType || "video/webm";
          const blob = new Blob(chunks, { type: outputType });
          const fileName = `telegram-stream-${Date.now()}.webm`;
          const strategy = await downloadCompatibility.saveBlob(
            blob,
            fileName,
            state.settings.downloadLocation,
          );
          logger.info(`Saved stream capture using strategy: ${strategy}`, fileName);
          stopTracks();
          resolve(strategy !== "failed");
        } catch (error) {
          logger.warn(`Failed to save stream capture: ${error.message}`);
          stopTracks();
          resolve(false);
        }
      };

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {}
        }
      };

      recorder.onstop = () => {
        finalize();
      };

      try {
        recorder.start();
      } catch {
        stopTracks();
        resolve(false);
        return;
      }

      timeoutId = setTimeout(() => {
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            stopTracks();
            resolve(false);
          }
        }
      }, maxDurationMs);
    });
  };

  const createQueuedDownloadHandler = ({ idPrefix, mediaKind, defaultExtension, fallbackMime }) => {
    return (url) => {
      const task = createQueueTask({
        url: requireDownloadUrl(url, idPrefix),
        mediaKind,
        defaultExtension,
        fallbackMime,
        idPrefix,
      });
      enqueueWithPicker(task);
    };
  };

  const createVisualDownloadHandler = ({
    idPrefix,
    defaultExtension,
    fallbackMime,
    expectedKind = "image",
  }) => {
    return (url) => {
      const task = createSingleVisualTask({
        url: requireDownloadUrl(url, idPrefix),
        idPrefix,
        defaultExtension,
        fallbackMime,
        expectedKind,
      });
      enqueueWithPicker(task);
    };
  };

  const downloadVideo = createQueuedDownloadHandler({
    idPrefix: "video",
    mediaKind: "video",
    defaultExtension: "mp4",
    fallbackMime: "video/mp4",
  });

  const downloadAudio = createQueuedDownloadHandler({
    idPrefix: "audio",
    mediaKind: "audio",
    defaultExtension: "ogg",
    fallbackMime: "audio/ogg",
  });

  const downloadImage = createVisualDownloadHandler({
    idPrefix: "image",
    defaultExtension: "jpg",
    fallbackMime: "image/jpeg",
    expectedKind: "image",
  });

  const downloadGif = createVisualDownloadHandler({
    idPrefix: "gif",
    defaultExtension: "gif",
    fallbackMime: "image/gif",
    expectedKind: "image",
  });

  const downloadSticker = createVisualDownloadHandler({
    idPrefix: "sticker",
    defaultExtension: "webp",
    fallbackMime: "image/webp",
    expectedKind: "image",
  });

  return {
    downloadVideo,
    downloadAudio,
    downloadImage,
    downloadGif,
    downloadSticker,
    captureStreamedVideo,
    restorePendingDownloads,
  };
})();
