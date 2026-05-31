#!/usr/bin/env node
/**
 * scripts/validate-build.js — verifies the built userscript:
 *   - starts with a // ==UserScript== block,
 *   - contains the expected @grant unsafeWindow directive (needed for the
 *     File System Access picker fix),
 *   - parses as JavaScript (uses Function constructor as a cheap syntax check),
 *   - is non-empty.
 */

const fs = require("fs");
const path = require("path");

const OUT_FILE = path.resolve(__dirname, "..", "telegram.user.js");
const PACKAGE_FILE = path.resolve(__dirname, "..", "package.json");

function main() {
  if (!fs.existsSync(OUT_FILE)) {
    console.error("✗ telegram.user.js not found. Run `npm run build` first.");
    process.exit(1);
  }
  const source = fs.readFileSync(OUT_FILE, "utf8");
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, "utf8"));
  const expectedVersion = String(pkg.version || "").trim();
  let errors = 0;

  if (!/^\/\/ ==UserScript==/.test(source)) {
    console.error("✗ Bundle does not start with // ==UserScript==");
    errors += 1;
  }
  if (!/@grant\s+unsafeWindow/.test(source)) {
    console.error("✗ Bundle missing `// @grant unsafeWindow` (required by picker fix).");
    errors += 1;
  }
  if (!/@grant\s+GM_download/.test(source)) {
    console.error(
      "✗ Bundle missing `// @grant GM_download` (required for cross-browser fallback).",
    );
    errors += 1;
  }
  const versionMatch = source.match(/^\/\/\s*@version\s+([^\s]+)\s*$/m);
  if (!versionMatch) {
    console.error("✗ Bundle missing `// @version ...` metadata.");
    errors += 1;
  } else if (versionMatch[1] !== expectedVersion) {
    console.error(
      `✗ Bundle version mismatch: bundle=${versionMatch[1]}, package.json=${expectedVersion}.`,
    );
    errors += 1;
  }
  if (source.length < 1000) {
    console.error(`✗ Bundle suspiciously small: ${source.length} bytes.`);
    errors += 1;
  }

  // Cheap syntax check.
  try {
    new Function(source);
  } catch (err) {
    console.error(`✗ Bundle failed to parse: ${err.message}`);
    errors += 1;
  }

  if (errors === 0) {
    console.log(`✓ Bundle OK (${source.length} bytes).`);
  } else {
    process.exit(1);
  }
}

main();
