const reportModule = (() => {
  const REPO_URL = "https://github.com/diorhc/TGP";
  const ISSUES_URL = `${REPO_URL}/issues/new`;
  const DISCUSSIONS_URL = `${REPO_URL}/discussions/new?category=ideas`;

  const getScriptVersion = () => {
    if (typeof GM_info !== "undefined" && GM_info?.script?.version) {
      return String(GM_info.script.version);
    }
    return "2.1.0";
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = createElement("textarea", {
      style: {
        position: "fixed",
        left: "-9999px",
        top: "0",
      },
      text,
    });
    appendToRoot(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const launchMailto = (subject, body) => {
    const anchor = document.createElement("a");
    anchor.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    anchor.style.display = "none";
    if (appendToRoot(anchor)) {
      anchor.click();
      anchor.remove();
    }
  };

  const buildReportText = ({ type, title, email, details, includeDebug, t }) => {
    const typeLabel =
      type === "feature"
        ? t("report.typeFeature", "Idea")
        : type === "bug"
          ? t("report.typeBug", "Bug")
          : t("report.typeOther", "Other");
    const lines = [
      `${t("report.kind", "Type")}: ${typeLabel}`,
      `${t("report.title", "Title")}: ${title || "-"}`,
      `${t("report.email", "Email")}: ${email || "-"}`,
      "",
      t("report.description", "Description"),
      details || "-",
    ];

    if (includeDebug) {
      lines.push(
        "",
        "---",
        t("report.debug", "Debug information"),
        `Version: ${getScriptVersion()}`,
        `URL: ${state.currentHref || location.href}`,
        `Theme: ${state.themeIsDark ? "dark" : "light"}`,
        `User Agent: ${navigator.userAgent}`,
        `Settings: ${JSON.stringify(normalizeSettings(state.settings), null, 2)}`,
      );
    }

    return lines.join("\n");
  };

  const buildDiagnosticsText = (t = i18n.t) => {
    const queueDiagnostics =
      typeof queueManager !== "undefined" &&
      typeof queueManager.getDiagnosticsSnapshot === "function"
        ? queueManager.getDiagnosticsSnapshot()
        : null;

    const payload = {
      generatedAt: new Date().toISOString(),
      version: getScriptVersion(),
      url: state.currentHref || location.href,
      theme: state.themeIsDark ? "dark" : "light",
      userAgent: navigator.userAgent,
      downloadStrategy: state.settings.downloadLocation,
      notificationsEnabled: Boolean(state.settings.enableNotifications),
      nativePickerSupported:
        typeof downloadCompatibility !== "undefined" &&
        typeof downloadCompatibility.isPickerSupported === "function"
          ? downloadCompatibility.isPickerSupported()
          : false,
      savePromptSupported:
        typeof downloadCompatibility !== "undefined" &&
        typeof downloadCompatibility.isSavePromptSupported === "function"
          ? downloadCompatibility.isSavePromptSupported()
          : false,
      queue: queueDiagnostics,
    };

    return [t("report.debug", "Debug information"), "---", JSON.stringify(payload, null, 2)].join(
      "\n",
    );
  };

  const copyDiagnostics = async (t = i18n.t) => {
    await copyText(buildDiagnosticsText(t));
  };

  const createView = ({ t }) => {
    const view = createElement("section", {
      className: "tel-settings-view tel-settings-report-view",
    });
    const card = createElement("div", {
      className: "tel-settings-view-card tel-settings-report-card",
    });
    const typeInput = createElement("select", {
      className: "tel-settings-select",
    });
    [
      { value: "bug", label: t("report.typeBug", "Bug") },
      { value: "feature", label: t("report.typeFeature", "Idea") },
      { value: "other", label: t("report.typeOther", "Other") },
    ].forEach((option) => {
      typeInput.append(
        createElement("option", {
          value: option.value,
          text: option.label,
        }),
      );
    });
    const titleInput = createElement("input", {
      className: "tel-settings-form-input",
      attributes: {
        type: "text",
        maxlength: "120",
        placeholder: t("report.titlePlaceholder", "Short one-line title"),
      },
    });
    const emailInput = createElement("input", {
      className: "tel-settings-form-input",
      attributes: {
        type: "email",
        placeholder: t("report.emailPlaceholder", "Your email (optional)"),
      },
    });
    const detailsInput = createElement("textarea", {
      className: "tel-settings-form-textarea",
      attributes: {
        rows: "7",
        placeholder: t(
          "report.detailsPlaceholder",
          "Describe the problem, reproduction steps, expected and actual result",
        ),
      },
    });
    const debugToggle = createElement("input", {
      type: "checkbox",
      className: "tel-settings-hidden-input",
      checked: true,
      attributes: {
        id: "tel-report-debug-toggle",
        "aria-label": t(
          "report.includeDebug",
          "Include debug information (version, URL, settings)",
        ),
      },
    });
    const debugCheck = createElement("span", {
      className: "tel-settings-check",
      attributes: { "aria-hidden": "true" },
    });
    const debugRow = createElement("div", {
      className: "tel-settings-report-debug",
      role: "switch",
      attributes: { tabindex: "0" },
    });
    const syncDebug = () => {
      debugCheck.classList.toggle("is-on", debugToggle.checked);
      debugRow.setAttribute("aria-checked", debugToggle.checked ? "true" : "false");
    };

    const toggleDebug = () => {
      debugToggle.checked = !debugToggle.checked;
      debugToggle.dispatchEvent(new Event("change", { bubbles: true }));
    };

    syncDebug();
    debugToggle.addEventListener("change", syncDebug);
    debugRow.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button, a, select, input")) {
        return;
      }
      toggleDebug();
    });
    debugRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleDebug();
      }
    });
    debugRow.append(
      debugCheck,
      createElement("span", {
        text: t("report.includeDebug", "Include debug information (version, URL, settings)"),
      }),
      debugToggle,
    );

    const actionRow = createElement("div", { className: "tel-settings-report-actions" });
    const githubButton = createElement("button", {
      type: "button",
      className: "tel-settings-secondary-btn",
      text: t("report.openGithub", "Open issue on GitHub"),
    });
    const copyButton = createElement("button", {
      type: "button",
      className: "tel-settings-secondary-btn",
      text: t("report.copy", "Copy report"),
    });
    const emailButton = createElement("button", {
      type: "button",
      className: "tel-settings-secondary-btn",
      text: t("report.emailAction", "Prepare email"),
    });

    const getPayload = () => ({
      type: typeInput.value,
      title: titleInput.value.trim(),
      email: emailInput.value.trim(),
      details: detailsInput.value.trim(),
      includeDebug: debugToggle.checked,
      t,
    });

    githubButton.addEventListener("click", () => {
      const payload = getPayload();
      const title = payload.title || t("report.defaultTitle", "YTP report");
      const body = buildReportText(payload);
      const targetUrl =
        payload.type === "feature"
          ? `${DISCUSSIONS_URL}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
          : `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      openInNewTab(targetUrl);
    });

    copyButton.addEventListener("click", async () => {
      try {
        await copyText(buildReportText(getPayload()));
        showNotification(t("report.copied", "Report copied"), "success");
      } catch (error) {
        showNotification(`${t("report.copyError", "Copy failed")}: ${error.message}`, "error");
      }
    });

    emailButton.addEventListener("click", () => {
      const payload = getPayload();
      const subject = payload.title || t("report.defaultTitle", "YTP report");
      launchMailto(subject, buildReportText(payload));
    });

    actionRow.append(githubButton, copyButton, emailButton);
    card.append(
      typeInput,
      titleInput,
      emailInput,
      detailsInput,
      debugRow,
      actionRow,
      createElement("p", {
        className: "tel-settings-helper-text",
        text: t(
          "report.footer",
          "Do not include passwords, tokens or private personal data in the report.",
        ),
      }),
    );
    view.append(card);
    return view;
  };

  return {
    createView,
    buildDiagnosticsText,
    copyDiagnostics,
  };
})();
