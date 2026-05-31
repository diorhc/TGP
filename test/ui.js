/** @jest-environment jsdom */

"use strict";

const fs = require("fs");
const path = require("path");

const loadUiHelpers = () => {
  const { window } = globalThis;
  const { document } = window;
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "ui.js"), "utf8");
  const factory = new Function(
    "window",
    "document",
    "location",
    "URL",
    "HTMLMediaElement",
    "HTMLVideoElement",
    `${source}\nreturn { getCandidateMediaUrl, isMseLikeVideo };`,
  );

  return factory(
    window,
    document,
    window.location,
    URL,
    window.HTMLMediaElement,
    window.HTMLVideoElement,
  );
};

describe("ui-media-buttons helpers", () => {
  test("getCandidateMediaUrl keeps blob URL for media elements", () => {
    const { document } = globalThis.window;
    const { getCandidateMediaUrl } = loadUiHelpers();
    const video = document.createElement("video");
    video.setAttribute("src", "blob:https://web.telegram.org/01234567-89ab-cdef-0123-456789abcdef");

    expect(getCandidateMediaUrl(video)).toMatch(/^blob:https:\/\/web\.telegram\.org\//);
  });

  test("getCandidateMediaUrl rejects page-like root URL", () => {
    const { document } = globalThis.window;
    const { getCandidateMediaUrl } = loadUiHelpers();
    const video = document.createElement("video");
    video.setAttribute("src", "/k/");

    expect(getCandidateMediaUrl(video)).toBe(null);
  });

  test("isMseLikeVideo detects blob-backed video URL", () => {
    const { document } = globalThis.window;
    const { isMseLikeVideo } = loadUiHelpers();
    const video = document.createElement("video");

    expect(isMseLikeVideo(video, "blob:https://web.telegram.org/stream")).toBe(true);
    expect(isMseLikeVideo(video, "https://cdn.telegram.org/video.mp4")).toBe(false);
  });
});
