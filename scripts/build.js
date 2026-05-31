#!/usr/bin/env node
/**
 * scripts/build.js — concatenate src/ modules into telegram.user.js
 *
 * Usage: node scripts/build.js (or `npm run build`)
 *
 * Module order is taken from build.order.json if present; otherwise files in
 * src/ are concatenated in lexicographic order.
 *
 * For modules that ship a CommonJS export footer (e.g. src/pure.js) the
 * `module.exports` block is stripped during bundling so the userscript bundle
 * stays free of Node-only constructs.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const OUT_FILE = path.join(ROOT, "telegram.user.js");
const ORDER_FILE = path.join(ROOT, "build.order.json");
const META_FILE = path.join(ROOT, "userscript.js");

/** Discover input files. */
function discoverFiles() {
  if (fs.existsSync(ORDER_FILE)) {
    const order = JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
    if (!Array.isArray(order.files)) {
      throw new Error("build.order.json: `files` must be an array");
    }
    return order.files.map((rel) => path.join(ROOT, rel));
  }

  // Fallback: lexicographic order, src/ only (non-recursive).
  return fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => path.join(SRC_DIR, f));
}

function readUserscriptMetadata() {
  if (!fs.existsSync(META_FILE)) {
    throw new Error("Missing metadata file: userscript.js");
  }
  const source = fs.readFileSync(META_FILE, "utf8");
  const match = source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  if (!match) {
    throw new Error(
      "userscript.js must contain a full // ==UserScript== ... // ==/UserScript== block",
    );
  }
  return match[0];
}

/** Strip Node-only CJS export footer so the bundle is clean. */
function stripCjsFooter(source) {
  return source.replace(
    /\n\s*\/\/[^\n]*\n\s*if \(typeof module !== "undefined" && module\.exports\)\s*\{[\s\S]*?\}\s*$/,
    "\n",
  );
}

function build() {
  const files = discoverFiles();
  const metadata = readUserscriptMetadata();
  if (files.length === 0) {
    console.error("No source files to build.");
    process.exit(1);
  }

  const parts = files.map((full) => {
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (!fs.existsSync(full)) {
      throw new Error(`Missing source file: ${rel}`);
    }
    const raw = fs.readFileSync(full, "utf8");
    const content = stripCjsFooter(raw);
    return `// ─── ${rel} ─────────────────────────────────────────────────────\n${content}`;
  });

  // The userscript bundle is wrapped in an IIFE with a re-entry guard. The
  // wrapper used to live in src/main.js (open) and src/ui.js (close), which
  // made those source files syntactically unbalanced when inspected in
  // isolation by IDEs and linters. Moving it here keeps every src/*.js valid
  // standalone JavaScript while preserving the exact bundle semantics.
  const bundlePrologue =
    "var PAGE_WINDOW = (() => {\n" +
    "  try {\n" +
    '    if (typeof unsafeWindow !== "undefined" && unsafeWindow) {\n' +
    "      return unsafeWindow.wrappedJSObject || unsafeWindow;\n" +
    "    }\n" +
    "  } catch {}\n" +
    "  return window;\n" +
    "})();\n\n" +
    "(() => {\n" +
    '  "use strict";\n\n' +
    '  const START_FLAG = "__TELEGRAM_PLUS_STARTED__";\n' +
    "  if (window[START_FLAG]) {\n" +
    '    console.warn("[Tel Download] Script already initialized");\n' +
    "    return;\n" +
    "  }\n" +
    "  window[START_FLAG] = true;\n";
  const bundleEpilogue = "\n})();\n";

  const body = parts.join("\n");
  fs.writeFileSync(
    OUT_FILE,
    `${metadata}\n\n${bundlePrologue}\n${body}\n${bundleEpilogue}`,
    "utf8",
  );
  console.log(`Built ${path.relative(ROOT, OUT_FILE)} from ${files.length} modules:`);
  files.forEach((full) => console.log(`  ${path.relative(ROOT, full).replace(/\\/g, "/")}`));
}

build();
