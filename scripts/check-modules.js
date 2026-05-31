#!/usr/bin/env node
/**
 * scripts/check-modules.js — sanity-check the module list:
 *   - every file in build.order.json exists,
 *   - every src/*.js file is referenced by the order file,
 *   - userscript.js contains a valid metadata header block,
 *   - source fragments do not contain trailing IIFE closure (`})();`).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ORDER_FILE = path.join(ROOT, "build.order.json");
const SRC_DIR = path.join(ROOT, "src");
const META_FILE = path.join(ROOT, "userscript.js");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(ORDER_FILE)) {
    console.error("build.order.json not found.");
    process.exit(2);
  }
  const order = JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
  const listed = new Set(order.files.map((f) => path.resolve(ROOT, f)));
  const onDisk = new Set(walk(SRC_DIR).map((f) => path.resolve(f)));

  let errors = 0;

  for (const file of listed) {
    if (!fs.existsSync(file)) {
      console.error(`✗ Listed but missing: ${path.relative(ROOT, file)}`);
      errors += 1;
    }
  }

  for (const file of onDisk) {
    if (!listed.has(file)) {
      console.error(`✗ On disk but not listed in build.order.json: ${path.relative(ROOT, file)}`);
      errors += 1;
    }
  }

  const pureIndex = order.files.indexOf("src/pure.js");
  const mainIndex = order.files.indexOf("src/main.js");
  if (pureIndex === -1 || mainIndex === -1) {
    console.error("✗ build.order.json must include both src/pure.js and src/main.js.");
    errors += 1;
  } else if (pureIndex > mainIndex) {
    console.error(
      "✗ Invalid module order: src/pure.js must be loaded before src/main.js (DEFAULT_SETTINGS TDZ risk).",
    );
    errors += 1;
  }

  const last = path.resolve(ROOT, order.files[order.files.length - 1]);
  if (!fs.existsSync(META_FILE)) {
    console.error("✗ Missing metadata file: userscript.js");
    errors += 1;
  } else {
    const metaSrc = fs.readFileSync(META_FILE, "utf8");
    if (!/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/.test(metaSrc)) {
      console.error("✗ userscript.js must contain a valid // ==UserScript== metadata block.");
      errors += 1;
    }
  }

  const lastSrc = fs.readFileSync(last, "utf8");
  // The outer IIFE wrapper is now injected by scripts/build.js (see prologue/
  // epilogue there), so individual source fragments must NOT carry it. Flag
  // any stray closing `})();` as a regression instead of requiring it.
  if (/\}\)\(\);\s*$/.test(lastSrc.trim())) {
    console.error(
      `✗ Last module (${path.relative(ROOT, last)}) still closes an outer IIFE — that wrapper is now emitted by scripts/build.js. Remove the trailing })(); from this file.`,
    );
    errors += 1;
  }

  if (errors === 0) {
    console.log(`✓ ${order.files.length} module(s) in sync.`);
  } else {
    console.error(`Failed with ${errors} error(s).`);
    process.exit(1);
  }
}

main();
