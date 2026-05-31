#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_FILE = path.join(ROOT, "package.json");
const META_FILE = path.join(ROOT, "userscript.js");
const BUNDLE_FILE = path.join(ROOT, "telegram.user.js");

function readPackageVersion() {
  if (!fs.existsSync(PACKAGE_FILE)) {
    throw new Error("package.json not found");
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, "utf8"));
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("package.json version is missing or invalid");
  }
  return pkg.version.trim();
}

function readMetadataVersion() {
  if (!fs.existsSync(META_FILE)) {
    throw new Error("userscript.js not found");
  }
  const source = fs.readFileSync(META_FILE, "utf8");
  const match = source.match(/^\s*\/\/\s*@version\s+([^\s]+)\s*$/m);
  if (!match) {
    throw new Error("@version not found in userscript.js metadata");
  }
  return match[1].trim();
}

function readBundleVersion() {
  if (!fs.existsSync(BUNDLE_FILE)) {
    return null;
  }
  const source = fs.readFileSync(BUNDLE_FILE, "utf8");
  const match = source.match(/^\s*\/\/\s*@version\s+([^\s]+)\s*$/m);
  if (!match) {
    throw new Error("@version not found in telegram.user.js metadata");
  }
  return match[1].trim();
}

function normalizeTagVersion(value) {
  const tag = String(value || "").trim();
  if (!tag) return "";
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function main() {
  let errors = 0;
  const includeBundleCheck = process.argv.includes("--include-bundle");

  const packageVersion = readPackageVersion();
  const metadataVersion = readMetadataVersion();
  const bundleVersion = includeBundleCheck ? readBundleVersion() : null;

  if (packageVersion !== metadataVersion) {
    console.error(
      `✗ Version mismatch: package.json=${packageVersion}, userscript.js=${metadataVersion}`,
    );
    errors += 1;
  }

  if (includeBundleCheck && !bundleVersion) {
    console.error("✗ telegram.user.js not found (run build before --include-bundle check)");
    errors += 1;
  }

  if (bundleVersion && packageVersion !== bundleVersion) {
    console.error(
      `✗ Version mismatch: package.json=${packageVersion}, telegram.user.js=${bundleVersion}`,
    );
    errors += 1;
  }

  const tagVersion = normalizeTagVersion(process.env.TAG_VERSION);
  if (tagVersion && tagVersion !== packageVersion) {
    console.error(`✗ Tag version mismatch: tag=${tagVersion}, package.json=${packageVersion}`);
    errors += 1;
  }

  if (errors > 0) {
    process.exit(1);
  }

  if (tagVersion) {
    console.log(`✓ Version sync OK: ${packageVersion} (tag v${tagVersion}).`);
    return;
  }

  console.log(`✓ Version sync OK: ${packageVersion}.`);
}

main();
