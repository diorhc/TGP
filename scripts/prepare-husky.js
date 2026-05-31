#!/usr/bin/env node

const { existsSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HUSKY_BIN = path.join(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "husky.cmd" : "husky",
);

if (!existsSync(HUSKY_BIN)) {
  console.log("[prepare] husky is not installed (dev dependencies are skipped). Continuing.");
  process.exit(0);
}

const result = spawnSync(HUSKY_BIN, [], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(0);
