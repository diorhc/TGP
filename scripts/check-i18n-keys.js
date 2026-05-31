#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const EN_LOCALE_PATH = path.join(ROOT, "locales", "en.json");

const KEY_REGEX = /\b(?:i18n\.t|t)\(\s*["'`]([^"'`]+)["'`]/g;

function collectSourceFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      return;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  });

  return files;
}

function collectUsedI18nKeys(files) {
  const keyToFiles = new Map();

  files.forEach((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = KEY_REGEX.exec(source))) {
      const key = String(match[1] || "").trim();
      if (!key) continue;
      if (!keyToFiles.has(key)) keyToFiles.set(key, new Set());
      keyToFiles.get(key).add(path.relative(ROOT, filePath).replace(/\\/g, "/"));
    }
  });

  return keyToFiles;
}

function main() {
  if (!fs.existsSync(EN_LOCALE_PATH)) {
    console.error("Missing locales/en.json");
    process.exit(1);
  }

  const enLocale = JSON.parse(fs.readFileSync(EN_LOCALE_PATH, "utf8"));
  const declaredKeys = new Set(Object.keys(enLocale));

  const sourceFiles = collectSourceFiles(SRC_DIR);
  const usedKeysMap = collectUsedI18nKeys(sourceFiles);
  const usedKeys = [...usedKeysMap.keys()].sort((a, b) => a.localeCompare(b));

  const missingKeys = usedKeys.filter((key) => !declaredKeys.has(key));

  if (missingKeys.length > 0) {
    console.error(
      `i18n key validation failed: ${missingKeys.length} key(s) used in src but missing in locales/en.json`,
    );
    missingKeys.forEach((key) => {
      const references = [...(usedKeysMap.get(key) || [])].sort();
      console.error(`- ${key}`);
      references.forEach((ref) => {
        console.error(`  referenced in ${ref}`);
      });
    });
    process.exit(1);
  }

  console.log(
    `i18n key validation passed (${usedKeys.length} used key(s), all declared in locales/en.json).`,
  );
}

main();
