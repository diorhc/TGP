#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const forbidden = ["usercsript.js"];

const found = forbidden.filter((name) => fs.existsSync(path.join(ROOT, name)));
if (found.length > 0) {
  console.error(`Legacy typo file(s) found: ${found.join(", ")}`);
  process.exit(1);
}

console.log("Legacy filename check passed.");
