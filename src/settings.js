/* global safeJsonParse, isPlainObject */

const settingsBuilder = {
  ensureStyles() {
    if (document.getElementById("tel-settings-styles")) return;
    const style = createElement("style", {
      attributes: { id: "tel-settings-styles" },
      text: SETTINGS_PANEL_CSS,
    });
    document.head.appendChild(style);
  },

  createToggleCard(id, title, description, checked) {
    const row = createElement("div", {
      className: "tel-settings-row tel-settings-row--toggle",
      attributes: { tabindex: "0" },
    });
    const textWrap = createElement("div");
    textWrap.append(
      createElement("p", {
        className: "tel-settings-row-title",
        text: title,
      }),
      createElement("p", {
        className: "tel-settings-row-desc",
        text: description,
      }),
    );
    const controls = createElement("div", {
      className: "tel-settings-row-controls",
    });
    const check = createElement("span", {
      className: "tel-settings-check",
      attributes: { "aria-hidden": "true" },
    });
    const input = createElement("input", {
      type: "checkbox",
      checked,
      className: "tel-settings-hidden-input",
      attributes: { id, "aria-label": title },
    });

    const toggle = () => {
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    row.setAttribute("role", "switch");
    row.setAttribute("aria-checked", input.checked ? "true" : "false");
    input.addEventListener("change", () => {
      check.classList.toggle("is-on", input.checked);
      row.setAttribute("aria-checked", input.checked ? "true" : "false");
    });
    check.classList.toggle("is-on", input.checked);

    row.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button, a, select, input")) {
        return;
      }
      toggle();
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
    controls.append(check, input);
    row.append(textWrap, controls);
    return { row, input };
  },

  createSelectCard(id, title, description, value, options) {
    const row = createElement("div", { className: "tel-settings-row" });
    const textWrap = createElement("div", { style: { flex: "1" } });
    textWrap.append(
      createElement("p", {
        className: "tel-settings-row-title",
        text: title,
      }),
      createElement("p", {
        className: "tel-settings-row-desc",
        text: description,
      }),
    );
    const selectWrap = createElement("div", {
      className: "tel-settings-select-wrap",
    });
    const select = createElement("select", {
      className: "tel-settings-select",
      attributes: { id },
    });
    options.forEach((option) => {
      const optionNode = createElement("option", {
        text: option.label,
        value: option.value,
      });
      if (option.value === value) optionNode.selected = true;
      select.appendChild(optionNode);
    });
    selectWrap.appendChild(select);
    textWrap.appendChild(selectWrap);
    row.append(textWrap, createElement("div", { className: "tel-settings-row-controls" }));
    return { row, select };
  },

  createIcon(paths, viewBox = "0 0 24 24") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    paths.forEach((pathDefinition) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      Object.entries(pathDefinition).forEach(([key, value]) => {
        path.setAttribute(key, value);
      });
      svg.appendChild(path);
    });

    return svg;
  },
};

const settingsModule = (() => {
  let settingsPanel = null;
  let lastFocusedElement = null;

  const viewState = {
    current: "settings",
  };

  const hide = () => {
    const overlay = settingsPanel || document.getElementById("tel-settings-overlay");
    if (overlay) overlay.remove();
    settingsPanel = null;
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      try {
        lastFocusedElement.focus({ preventScroll: true });
      } catch {
        lastFocusedElement.focus();
      }
    }
    lastFocusedElement = null;
  };

  const createPanel = () => {
    const t = i18n.t;
    settingsBuilder.ensureStyles();
    const overlay = createElement("div", {
      attributes: { id: "tel-settings-overlay" },
      style: styleFactory.modalOverlay(),
    });
    const panel = createElement("div", { className: "tel-settings-shell" });
    const main = createElement("div", { className: "tel-settings-main" });
    const left = createElement("div", {
      className: "tel-settings-topbar-left",
    });
    const right = createElement("div", {
      className: "tel-settings-topbar-right",
    });

    left.append(
      createElement("span", {
        className: "tel-settings-title-pill",
        text: t("settings.title", "Settings"),
      }),
    );

    const saveButton = createElement("button", {
      type: "button",
      className: "tel-settings-save-btn",
      text: t("settings.save", "Save changes"),
    });
    const closeButton = createElement("button", {
      type: "button",
      className: "tel-settings-close-btn",
      text: "×",
      ariaLabel: t("settings.close", "Close settings"),
    });
    closeButton.addEventListener("click", hide);

    const content = createElement("div", {
      className: "tel-settings-content",
    });
    const toolbar = createElement("div", { className: "tel-settings-toolbar" });
    const toolbarCenter = createElement("div", { className: "tel-settings-toolbar-center" });
    const contentRow = createElement("div", {
      className: "tel-settings-content-row",
    });
    const sidebar = createElement("div", { className: "tel-settings-sidebar" });
    const centerColumn = createElement("div", { className: "tel-settings-center-column" });
    const homeList = createElement("div", { className: "tel-settings-list" });
    const advancedList = createElement("div", { className: "tel-settings-list" });
    const actionsRail = createElement("div", { className: "tel-settings-actions-rail" });
    const viewHost = createElement("div", { className: "tel-settings-view-host" });
    const homeView = createElement("div", {
      className: "tel-settings-view tel-settings-settings-view",
    });
    const advancedView = createElement("div", {
      className: "tel-settings-view tel-settings-advanced-view",
    });

    const notifications = settingsBuilder.createToggleCard(
      "tel-setting-notifications",
      t("settings.notifications.title", "Notifications"),
      t("settings.notifications.desc", "Show download status, errors and successful saves"),
      state.settings.enableNotifications,
    );
    const keyboard = settingsBuilder.createToggleCard(
      "tel-setting-keyboard",
      t("settings.keyboard.title", "Keyboard shortcuts"),
      t("settings.keyboard.desc", "Video control with arrows, M, P and Home in WebK/WebZ"),
      state.settings.enableKeyboardShortcuts,
    );
    const adblock = settingsBuilder.createToggleCard(
      "tel-setting-adblock",
      t("settings.adblock.title", "Ad blocking"),
      t("settings.adblock.desc", "Hide sponsored blocks and ad inserts"),
      state.settings.enableAdBlocking,
    );
    const streamCapture = settingsBuilder.createToggleCard(
      "tel-setting-stream-capture",
      t("settings.streamCapture.title", "Experimental stream capture"),
      t(
        "settings.streamCapture.desc",
        "For blob/MSE videos, try MediaRecorder capture on click (best effort)",
      ),
      state.settings.enableExperimentalStreamCapture,
    );
    const pickerSupported = downloadCompatibility.isSavePromptSupported();
    const pickerLabel = t("settings.downloadMode.picker", "Ask where to save");
    const downloadMode = settingsBuilder.createSelectCard(
      "tel-setting-download-mode",
      t("settings.downloadMode.title", "Download strategy"),
      t("settings.downloadMode.desc", "Browser mode, system picker or graceful fallback"),
      state.settings.downloadLocation,
      [
        {
          value: "browser",
          label: t("settings.downloadMode.browser", "Through browser"),
        },
        {
          value: "picker",
          label: pickerSupported
            ? pickerLabel
            : `${pickerLabel} ${t("settings.downloadMode.pickerUnsupportedSuffix", "(Chrome/Edge only)")}`,
        },
        {
          value: "tab",
          label: t("settings.downloadMode.tab", "Open in new tab"),
        },
        {
          value: "auto",
          label: t("settings.downloadMode.auto", "Auto-select with fallback"),
        },
      ],
    );
    const language = settingsBuilder.createSelectCard(
      "tel-setting-language",
      t("settings.language.title", "Language"),
      t("settings.language.desc", "Choose interface language"),
      state.settings.uiLanguage,
      i18n.getLanguageOptions().map((option) => ({
        value: option.value,
        label:
          option.value === "auto"
            ? t("settings.language.auto", "Automatic (browser)")
            : option.label,
      })),
    );

    const applyAndRefreshSettings = (nextSettings, options = {}) => {
      const { successMessage = "", closePanel = true } = options;
      state.settings = normalizeSettings(nextSettings);
      saveSettings(state.settings);
      i18n.setLocale(state.settings.uiLanguage);

      if (typeof uiModule !== "undefined" && typeof uiModule.refresh === "function") {
        uiModule.refresh();
      }
      if (
        typeof progressFactory !== "undefined" &&
        typeof progressFactory.refreshTexts === "function"
      ) {
        progressFactory.refreshTexts();
      }
      if (
        typeof observersModule !== "undefined" &&
        typeof observersModule.refreshAdBlocking === "function"
      ) {
        observersModule.refreshAdBlocking();
      }
      if (state.settings.enableNotifications && successMessage) {
        showNotification(successMessage, "success");
      }

      if (closePanel) {
        hide();
      }
    };

    const collectToggleSettings = () => ({
      ...state.settings,
      enableNotifications: notifications.input.checked,
      enableKeyboardShortcuts: keyboard.input.checked,
      enableAdBlocking: adblock.input.checked,
      enableExperimentalStreamCapture: streamCapture.input.checked,
    });

    const collectAllSettings = () => ({
      ...collectToggleSettings(),
      downloadLocation: downloadMode.select.value,
      uiLanguage: language.select.value,
    });

    const persistToggleSettings = () => {
      applyAndRefreshSettings(collectToggleSettings(), { closePanel: false });
    };

    const importInput = createElement("input", {
      type: "file",
      attributes: { accept: "application/json,.json" },
      style: { display: "none" },
    });

    const createSettingsBackupName = () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      return `telegram-plus-settings-${stamp}.json`;
    };

    const exportSettings = () => {
      try {
        const payload = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          settings: normalizeSettings(state.settings),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const link = createElement("a", {
          attributes: {
            href: URL.createObjectURL(blob),
            download: createSettingsBackupName(),
          },
          style: { display: "none" },
        });
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(link.href);
          link.remove();
        }, 0);

        if (state.settings.enableNotifications) {
          showNotification(t("settings.exported", "Settings exported"), "success");
        }
      } catch (error) {
        showNotification(
          `${t("settings.importError", "Settings import/export error")}: ${error.message}`,
          "error",
        );
      }
    };

    const importSettings = async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (!file) return;

      try {
        const content = await file.text();
        const parsed = safeJsonParse(content, null);
        const imported = isPlainObject(parsed) && parsed.settings ? parsed.settings : parsed;

        if (!isPlainObject(imported)) {
          throw new Error(t("settings.invalidBackup", "Invalid settings backup format"));
        }

        applyAndRefreshSettings(
          {
            ...state.settings,
            ...imported,
          },
          {
            successMessage: t("settings.imported", "Settings imported"),
            closePanel: true,
          },
        );
      } catch (error) {
        showNotification(
          `${t("settings.importError", "Settings import/export error")}: ${error.message}`,
          "error",
        );
      }
    };

    const exportButton = createElement("button", {
      type: "button",
      className: "tel-settings-action-btn",
      ariaLabel: t("settings.export", "Export settings"),
      title: t("settings.export", "Export settings"),
    });
    exportButton.append(
      settingsBuilder.createIcon([
        {
          d: "M4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12",
          fill: "none",
          stroke: "currentColor",
          opacity: "0.5",
          "stroke-width": "1.5",
          "stroke-linecap": "round",
        },
        {
          d: "M12 14L12 4M12 4L15 7M12 4L9 7",
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": "1.5",
        },
      ]),
    );
    exportButton.addEventListener("click", exportSettings);

    const importButton = createElement("button", {
      type: "button",
      className: "tel-settings-action-btn",
      ariaLabel: t("settings.import", "Import settings"),
      title: t("settings.import", "Import settings"),
    });
    importButton.append(
      settingsBuilder.createIcon([
        {
          d: "M4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12",
          fill: "none",
          stroke: "currentColor",
          opacity: "0.5",
          "stroke-width": "1.5",
          "stroke-linecap": "round",
        },
        {
          d: "M12 4L12 14M12 14L15 11M12 14L9 11",
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": "1.5",
        },
      ]),
    );
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", importSettings);

    const setView = (viewName) => {
      viewState.current = viewName;
      viewHost.replaceChildren();
      sidebar.querySelectorAll(".tel-settings-sidebar-btn").forEach((node) => {
        node.classList.toggle("is-active", node.dataset.view === viewName);
      });

      if (viewName === "about" && typeof updateModule !== "undefined") {
        viewHost.append(updateModule.createView({ t }));
        right.replaceChildren(saveButton);
        actionsRail.replaceChildren(closeButton);
        return;
      }

      if (viewName === "report" && typeof reportModule !== "undefined") {
        viewHost.append(reportModule.createView({ t }));
        right.replaceChildren(saveButton);
        actionsRail.replaceChildren(closeButton);
        return;
      }

      if (viewName === "advanced") {
        viewHost.append(advancedView);
        right.replaceChildren(saveButton);
        actionsRail.replaceChildren(closeButton);
        return;
      }

      viewHost.append(homeView);
      right.replaceChildren(saveButton, exportButton, importButton);
      actionsRail.replaceChildren(closeButton, exportButton, importButton);
    };

    const persistSettings = () => {
      const requestedDownloadLocation = downloadMode.select.value;
      if (
        requestedDownloadLocation === "picker" &&
        !downloadCompatibility.isSavePromptSupported()
      ) {
        showNotification(
          t(
            "settings.downloadMode.pickerUnsupported",
            "System picker is unavailable in this browser. Fallback strategy will be used.",
          ),
          "info",
          4500,
        );
      }
      const nextSettings = collectAllSettings();
      nextSettings.downloadLocation = requestedDownloadLocation;
      applyAndRefreshSettings(nextSettings, {
        successMessage: t("settings.saved", "Settings saved"),
        closePanel: true,
      });
    };

    [notifications.input, keyboard.input, adblock.input, streamCapture.input].forEach((input) => {
      input.addEventListener("change", persistToggleSettings);
    });

    saveButton.addEventListener("click", persistSettings);
    downloadMode.select.addEventListener("keydown", (event) => {
      if (event.key === "Enter") persistSettings();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) hide();
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        hide();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = Array.from(
        panel.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.disabled && node.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });

    homeList.append(
      notifications.row,
      keyboard.row,
      adblock.row,
      streamCapture.row,
      downloadMode.row,
    );
    const shortcutsWrap = createElement("div");
    shortcutsWrap.append(
      createElement("p", {
        className: "tel-settings-row-title",
        text: t("settings.keyboard.title", "Keyboard shortcuts"),
      }),
      createElement("p", {
        className: "tel-settings-row-desc",
        text: "\u2190 \u2192 seek \u00b7 \u2191 \u2193 volume \u00b7 M mute \u00b7 P PiP \u00b7 Home start",
      }),
    );
    const shortcutsRow = createElement("div", {
      className: "tel-settings-row tel-settings-info-row",
    });
    shortcutsRow.append(
      shortcutsWrap,
      createElement("div", { className: "tel-settings-row-controls" }),
    );

    const diagnosticsWrap = createElement("div");
    diagnosticsWrap.append(
      createElement("p", {
        className: "tel-settings-row-title",
        text: t("settings.diagnostics.title", "Diagnostics"),
      }),
      createElement("p", {
        className: "tel-settings-row-desc",
        text: t("settings.diagnostics.desc", "Copy runtime report for debugging and issue tickets"),
      }),
    );
    const diagnosticsButton = createElement("button", {
      type: "button",
      className: "tel-settings-secondary-btn",
      text: t("settings.diagnostics.copy", "Copy diagnostics report"),
    });
    diagnosticsButton.addEventListener("click", async () => {
      try {
        if (typeof reportModule?.copyDiagnostics === "function") {
          await reportModule.copyDiagnostics(t);
          showNotification(t("settings.diagnostics.copied", "Diagnostics copied"), "success");
          return;
        }
        throw new Error("Report module is unavailable");
      } catch (error) {
        showNotification(
          `${t("settings.diagnostics.copyError", "Failed to copy diagnostics")}: ${error.message}`,
          "error",
        );
      }
    });
    const diagnosticsControls = createElement("div", { className: "tel-settings-row-controls" });
    diagnosticsControls.append(diagnosticsButton);
    const diagnosticsRow = createElement("div", {
      className: "tel-settings-row tel-settings-info-row",
    });
    diagnosticsRow.append(diagnosticsWrap, diagnosticsControls);

    advancedList.append(language.row, shortcutsRow, diagnosticsRow);
    homeView.append(homeList);
    advancedView.append(advancedList);
    const homeSidebarIcon = settingsBuilder.createIcon([
      {
        d: "M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z",
        stroke: "currentColor",
        "stroke-width": "1.5",
        opacity: "0.5",
        fill: "none",
      },
      {
        d: "M15 18H9",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        fill: "none",
      },
    ]);
    homeSidebarIcon.setAttribute("fill", "none");

    const advancedSidebarIcon = settingsBuilder.createIcon([
      {
        d: "M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12",
        stroke: "currentColor",
        "stroke-width": "1.5",
        opacity: "0.5",
        fill: "none",
      },
      {
        d: "M2 14C2 11.1997 2 9.79961 2.54497 8.73005C3.02433 7.78924 3.78924 7.02433 4.73005 6.54497C5.79961 6 7.19974 6 10 6H14C16.8003 6 18.2004 6 19.27 6.54497C20.2108 7.02433 20.9757 7.78924 21.455 8.73005C22 9.79961 22 11.1997 22 14C22 16.8003 22 18.2004 21.455 19.27C20.9757 20.2108 20.2108 20.9757 19.27 21.455C18.2004 22 16.8003 22 14 22H10C7.19974 22 5.79961 22 4.73005 21.455C3.78924 20.9757 3.02433 20.2108 2.54497 19.27C2 18.2004 2 16.8003 2 14Z",
        stroke: "currentColor",
        "stroke-width": "1.5",
        fill: "none",
      },
      {
        d: "M9.5 14.4L10.9286 16L14.5 12",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        fill: "none",
      },
    ]);
    advancedSidebarIcon.setAttribute("fill", "none");

    const reportSidebarIcon = settingsBuilder.createIcon([
      {
        d: "M4 6V19C4 20.6569 5.34315 22 7 22H17C18.6569 22 20 20.6569 20 19V9C20 7.34315 18.6569 6 17 6H4ZM4 6V5",
        stroke: "currentColor",
        "stroke-width": "1.5",
        fill: "none",
      },
      {
        d: "M18 6.00002V6.75002H18.75V6.00002H18ZM15.7172 2.32614L15.6111 1.58368L15.7172 2.32614ZM4.91959 3.86865L4.81353 3.12619H4.81353L4.91959 3.86865ZM5.07107 6.75002H18V5.25002H5.07107V6.75002ZM18.75 6.00002V4.30604H17.25V6.00002H18.75ZM15.6111 1.58368L4.81353 3.12619L5.02566 4.61111L15.8232 3.0686L15.6111 1.58368ZM4.81353 3.12619C3.91638 3.25435 3.25 4.0227 3.25 4.92895H4.75C4.75 4.76917 4.86749 4.63371 5.02566 4.61111L4.81353 3.12619ZM18.75 4.30604C18.75 2.63253 17.2678 1.34701 15.6111 1.58368L15.8232 3.0686C16.5763 2.96103 17.25 3.54535 17.25 4.30604H18.75ZM5.07107 5.25002C4.89375 5.25002 4.75 5.10627 4.75 4.92895H3.25C3.25 5.9347 4.06532 6.75002 5.07107 6.75002V5.25002Z",
        fill: "currentColor",
      },
      {
        d: "M8 12H16",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        opacity: "0.5",
        fill: "none",
      },
      {
        d: "M8 15.5H13.5",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        opacity: "0.5",
        fill: "none",
      },
    ]);
    reportSidebarIcon.setAttribute("fill", "none");

    const aboutSidebarIcon = settingsBuilder.createIcon([
      {
        d: "M15.5 9L15.6716 9.17157C17.0049 10.5049 17.6716 11.1716 17.6716 12C17.6716 12.8284 17.0049 13.4951 15.6716 14.8284L15.5 15",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        fill: "none",
      },
      {
        d: "M13.2942 7.17041L12.0001 12L10.706 16.8297",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        fill: "none",
      },
      {
        d: "M8.49994 9L8.32837 9.17157C6.99504 10.5049 6.32837 11.1716 6.32837 12C6.32837 12.8284 6.99504 13.4951 8.32837 14.8284L8.49994 15",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        fill: "none",
      },
      {
        d: "M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z",
        stroke: "currentColor",
        "stroke-width": "1.5",
        opacity: "0.5",
        fill: "none",
      },
    ]);
    aboutSidebarIcon.setAttribute("fill", "none");

    const sidebarItems = [
      {
        iconNode: homeSidebarIcon,
        title: t("settings.nav.home", "Settings"),
        view: "home",
        target: notifications.row,
      },
      {
        iconNode: advancedSidebarIcon,
        title: t("settings.nav.advanced", "Advanced"),
        view: "advanced",
        target: null,
      },
      {
        iconNode: reportSidebarIcon,
        title: t("settings.nav.report", "Report"),
        view: "report",
        target: null,
      },
      {
        iconNode: aboutSidebarIcon,
        title: t("settings.nav.about", "About"),
        view: "about",
        target: null,
      },
    ];

    sidebarItems.forEach((item, index) => {
      const button = createElement("button", {
        type: "button",
        className: `tel-settings-sidebar-btn${index === 0 ? " is-active" : ""}`,
        ariaLabel: item.title,
        title: item.title,
        attributes: { "data-view": item.view },
      });
      button.append(item.iconNode);
      button.addEventListener("click", () => {
        setView(item.view);
        toolbarCenter.textContent = item.title;
        if (item.view === "home" && item.target) {
          item.target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      sidebar.append(button);
    });

    toolbarCenter.textContent = sidebarItems[0].title;
    toolbar.append(left, toolbarCenter, right);
    centerColumn.append(toolbar, viewHost);
    contentRow.append(sidebar, centerColumn, actionsRail);
    content.append(contentRow, importInput);
    main.append(content);
    panel.append(main);
    overlay.appendChild(panel);
    setView("home");
    appendToRoot(overlay);
    return overlay;
  };

  return {
    ensurePanel() {
      if (!settingsPanel || !document.body.contains(settingsPanel)) {
        settingsPanel = createPanel();
      }
      return settingsPanel;
    },
    show() {
      if (!lastFocusedElement) {
        lastFocusedElement = document.activeElement;
      }
      const overlay = this.ensurePanel();
      overlay.style.display = "flex";
      const closeButton = overlay.querySelector(".tel-settings-close-btn");
      if (closeButton instanceof HTMLElement) {
        closeButton.focus();
      }
    },
    hide,
  };
})();
