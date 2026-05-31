#!/usr/bin/env node
/**
 * scripts/build-esbuild.js - optional post-build optimizers.
 *
 * Modes:
 *   --min        => aggressive minification (telegram.min.user.js)
 *   --optimized  => readable optimization (telegram.optimized.user.js)
 *
 * Falls back gracefully if esbuild isn't installed.
 */

const fs = require("fs");
const path = require("path");

let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  console.warn("esbuild not installed — skipping minified build. `npm i -D esbuild` to enable.");
  process.exit(0);
}

const ROOT = path.resolve(__dirname, "..");
const IN_FILE = path.join(ROOT, "telegram.user.js");
const MIN_OUT_FILE = path.join(ROOT, "telegram.min.user.js");
const OPTIMIZED_OUT_FILE = path.join(ROOT, "telegram.user.js");

if (!fs.existsSync(IN_FILE)) {
  console.error("Run `npm run build` first.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const isOptimized = args.has("--optimized") || args.has("-o");
const isMin = args.has("--min") || args.has("-m") || !isOptimized;

const source = fs.readFileSync(IN_FILE, "utf8");
// Preserve the UserScript header verbatim — esbuild would strip it.
const headerMatch = source.match(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
const header = headerMatch ? headerMatch[0] : "";
const body = headerMatch ? source.slice(headerMatch[0].length) : source;

const normalizeWhitespace = (src) => {
  const lines = src.split("\n").map((line) => line.replace(/\s+$/g, ""));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const stripPureAnnotations = (src) => src.replace(/\/\*\s*@__PURE__\s*\*\//g, "");

const buildOptimizedReadable = () => {
  // Ask esbuild to optimize syntax without identifier mangling and without
  // fully collapsing whitespace, then trim trailing spaces / extra blank lines.
  return esbuild
    .transform(body, {
      minifySyntax: true,
      minifyIdentifiers: false,
      minifyWhitespace: false,
      target: "es2020",
      legalComments: "none",
      sourcemap: false,
      charset: "utf8",
    })
    .then((result) => normalizeWhitespace(stripPureAnnotations(result.code)));
};

Promise.resolve()
  .then(() => {
    if (isOptimized) {
      return buildOptimizedReadable().then((code) => ({
        outFile: OPTIMIZED_OUT_FILE,
        code,
        mode: "optimized",
      }));
    }

    if (isMin) {
      return esbuild
        .transform(body, {
          minify: true,
          target: "es2020",
          legalComments: "none",
          sourcemap: false,
          charset: "utf8",
        })
        .then((result) => ({
          outFile: MIN_OUT_FILE,
          code: result.code,
          mode: "min",
        }));
    }

    return null;
  })
  .then((result) => {
    if (!result) {
      console.error("Unknown mode. Use --min or --optimized.");
      process.exit(1);
      return;
    }

    fs.writeFileSync(result.outFile, `${header}\n${result.code}\n`, "utf8");
    console.log(
      `Built ${path.basename(result.outFile)} [${result.mode}] (${result.code.length} bytes vs ${body.length} source body).`,
    );
  })
  .catch((err) => {
    console.error("esbuild failed:", err);
    process.exit(1);
  });
