const updateModule = (() => {
  const REPO_URL = "https://github.com/diorhc/TGP";
  const DISCUSSIONS_URL = `${REPO_URL}/discussions`;
  const GREASYFORK_URL = "https://greasyfork.org/en/scripts/537433-telegram-plus";
  const UPDATE_URL = "https://update.greasyfork.org/scripts/537433/Telegram%20%2B.user.js";

  const getScriptVersion = () => {
    if (typeof GM_info !== "undefined" && GM_info?.script?.version) {
      return String(GM_info.script.version);
    }
    return "2.1.0";
  };

  const createLinkButton = (label, href, className = "tel-settings-link-btn") => {
    const button = createElement("button", {
      type: "button",
      className,
      text: label,
    });
    button.addEventListener("click", () => openInNewTab(href));
    return button;
  };

  const makePathIcon = (d) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  };

  const createKickerIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "app-icon");
    svg.setAttribute("width", "90");
    svg.setAttribute("height", "90");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("version", "1.1");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "m23.24,4.62c-0.85,0.45 -2.19,2.12 -4.12,5.13c-1.54,2.41 -2.71,4.49 -3.81,6.8c-0.55,1.14 -1.05,2.2 -1.13,2.35c-0.08,0.16 -0.78,0.7 -1.66,1.28c-1.38,0.91 -1.8,1.29 -1.4,1.28c0.08,0 0.67,-0.35 1.31,-0.77c0.64,-0.42 1.19,-0.76 1.2,-0.74c0.02,0.02 -0.1,0.31 -0.25,0.66c-1.03,2.25 -1.84,5.05 -1.84,6.37c0.01,1.89 0.84,2.67 2.86,2.67c1.08,0 1.94,-0.31 3.66,-1.29c1.84,-1.06 3.03,-1.93 4.18,-3.09c1.69,-1.7 2.91,-3.4 3.28,-4.59c0.59,-1.9 -0.1,-3.08 -2.02,-3.44c-0.87,-0.16 -2.85,-0.14 -3.75,0.06c-1.78,0.38 -2.74,0.76 -2.5,1c0.03,0.03 0.5,-0.1 1.05,-0.28c1.49,-0.48 2.34,-0.59 3.88,-0.53c1.64,0.07 2.09,0.19 2.69,0.75l0.46,0.43l0,0.87c0,0.74 -0.05,0.98 -0.35,1.6c-0.69,1.45 -2.69,3.81 -4.37,5.14c-0.93,0.74 -2.88,1.94 -4.07,2.5c-1.64,0.77 -3.56,0.72 -4.21,-0.11c-0.39,-0.5 -0.5,-1.02 -0.44,-2.11c0.05,-0.85 0.16,-1.32 0.67,-2.86c0.34,-1.01 0.86,-2.38 1.15,-3.04c0.52,-1.18 0.55,-1.22 1.6,-2.14c4.19,-3.65 8.42,-9.4 9.02,-12.26c0.2,-0.94 0.13,-1.46 -0.21,-1.7c-0.31,-0.22 -0.38,-0.21 -0.89,0.06m0.19,0.26c-0.92,0.41 -3.15,3.44 -5.59,7.6c-1.05,1.79 -3.12,5.85 -3.02,5.95c0.07,0.07 1.63,-1.33 2.58,-2.34c1.57,-1.65 3.73,-4.39 4.88,-6.17c1.31,-2.03 2.06,-4.11 1.77,-4.89c-0.13,-0.34 -0.16,-0.35 -0.62,-0.15m11.69,13.32c-0.3,0.6 -1.19,2.54 -1.98,4.32c-1.6,3.62 -1.67,3.71 -2.99,4.34c-1.13,0.54 -2.31,0.85 -3.54,0.92c-0.99,0.06 -1.08,0.04 -1.38,-0.19c-0.28,-0.22 -0.31,-0.31 -0.26,-0.7c0.03,-0.25 0.64,-1.63 1.35,-3.08c1.16,-2.36 2.52,-5.61 2.52,-6.01c0,-0.49 -0.36,0.19 -1.17,2.22c-0.51,1.26 -1.37,3.16 -1.93,4.24c-0.55,1.08 -1.04,2.17 -1.09,2.43c-0.1,0.59 0.07,1.03 0.49,1.28c0.78,0.46 3.3,0.06 5.13,-0.81l0.93,-0.45l-0.66,1.25c-0.7,1.33 -3.36,6.07 -4.31,7.67c-2.02,3.41 -3.96,5.32 -6.33,6.21c-2.57,0.96 -4.92,0.74 -6.14,-0.58c-0.81,-0.88 -0.82,-1.71 -0.04,-3.22c1.22,-2.36 6.52,-6.15 10.48,-7.49c0.52,-0.18 0.95,-0.39 0.95,-0.46c0,-0.21 -0.19,-0.18 -1.24,0.2c-1.19,0.43 -3.12,1.37 -4.34,2.11c-2.61,1.59 -5.44,4.09 -6.13,5.43c-1.15,2.2 -0.73,3.61 1.4,4.6c0.59,0.28 0.75,0.3 2.04,0.3c1.67,0 2.42,-0.18 3.88,-0.89c1.87,-0.92 3.17,-2.13 4.72,-4.41c0.98,-1.44 4.66,-7.88 5.91,-10.33c0.25,-0.49 0.68,-1.19 0.96,-1.56c0.28,-0.37 0.76,-1.15 1.06,-1.73c0.82,-1.59 2.58,-6.10 2.58,-6.6c0,-0.06 -0.07,-0.1 -0.17,-0.1c-0.10,0 -0.39,0.44 -0.71,1.09m-1.34,3.7c-0.93,2.08 -1.09,2.48 -0.87,2.2c0.19,-0.24 1.66,-3.65 1.6,-3.71c-0.02,-0.02 -0.35,0.66 -0.73,1.51",
    );
    path.setAttribute("fill", "none");
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("stroke", "currentColor");

    svg.appendChild(path);
    return svg;
  };

  const createView = ({ t }) => {
    const view = createElement("section", {
      className: "tel-settings-view tel-settings-about-view",
    });

    const hero = createElement("div", { className: "tel-settings-about-hero" });
    const kicker = createElement("div", { className: "tel-settings-about-kicker" });
    kicker.append(createKickerIcon());
    hero.append(
      kicker,
      createElement("h1", {
        className: "tel-settings-about-title",
        text: t("about.title", "Telegram +"),
      }),
    );

    const card = createElement("div", {
      className: "tel-settings-view-card tel-settings-about-card",
    });

    const statusSurface = createElement("div", { className: "tel-settings-about-status-surface" });
    const meta = createElement("div", { className: "tel-settings-about-meta" });
    const versionRow = createElement("div", { className: "tel-settings-about-version-row" });
    versionRow.append(
      createElement("span", {
        className: "tel-settings-about-version-label",
        text: t("about.currentVersion", "Current version"),
      }),
      createElement("span", {
        className: "tel-settings-about-version-badge",
        text: getScriptVersion(),
      }),
    );
    const status = createElement("span", {
      className: "tel-settings-about-status",
      text: t("about.status", "● Auto-update"),
    });
    meta.append(versionRow);
    statusSurface.append(meta, status);

    const updateRow = createElement("div", { className: "tel-settings-about-update-row" });
    const checkBtn = createElement("button", {
      type: "button",
      className: "tel-settings-update-btn",
      text: t("about.checkUpdates", "Check updates"),
    });
    checkBtn.prepend(
      makePathIcon(
        "M21 12C21 16.9706 16.9706 21 12 21C9.69494 21 7.59227 20.1334 6 18.7083L3 16M3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168L21 8M3 16V22M21 8V2",
      ),
    );
    checkBtn.addEventListener("click", () => openInNewTab(GREASYFORK_URL));
    updateRow.append(
      checkBtn,
      createLinkButton("\u2197", UPDATE_URL, "tel-settings-update-icon-btn"),
    );

    const updatePanel = createElement("div", { className: "tel-settings-about-update-panel" });
    updatePanel.append(statusSurface, updateRow);

    const links = createElement("div", { className: "tel-settings-about-links" });
    links.append(
      createLinkButton("GitHub", REPO_URL),
      createLinkButton("Discussions", DISCUSSIONS_URL),
      createLinkButton("GreasyFork", GREASYFORK_URL),
    );

    const footer = createElement("p", {
      className: "tel-settings-about-footer",
      text: "Made with \u2764\uFE0F by diorhc \u00b7 License: MIT",
    });

    card.append(
      hero,
      createElement("h2", {
        className: "tel-settings-card-title",
        text: t(
          "about.descriptionTitle",
          "Extended Telegram Web experience with downloads, shortcuts and utility tools",
        ),
      }),
      updatePanel,
      links,
      footer,
    );

    view.append(card);
    return view;
  };

  return { createView };
})();
