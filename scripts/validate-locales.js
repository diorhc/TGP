#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "locales");

const REQUIRED_CODES = [
  "ar",
  "az",
  "be",
  "bg",
  "cn",
  "de",
  "du",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "jp",
  "kk",
  "kr",
  "ky",
  "pl",
  "pt",
  "ru",
  "tr",
  "tw",
  "uk",
  "uz",
  "vi",
];

function readJson(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return JSON.parse(source);
}

function main() {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error("locales/ directory is missing");
    process.exit(1);
  }

  const files = fs
    .readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const codesOnDisk = files.map((name) => path.basename(name, ".json").toLowerCase());

  let errors = 0;

  REQUIRED_CODES.forEach((code) => {
    if (!codesOnDisk.includes(code)) {
      console.error(`Missing locale file: locales/${code}.json`);
      errors += 1;
    }
  });

  const extras = codesOnDisk.filter((code) => !REQUIRED_CODES.includes(code));
  extras.forEach((code) => {
    console.error(`Unexpected locale file: locales/${code}.json`);
    errors += 1;
  });

  if (errors > 0) {
    console.error(`Locale file set validation failed with ${errors} error(s).`);
    process.exit(1);
  }

  const basePath = path.join(LOCALES_DIR, "en.json");
  const base = readJson(basePath);
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    console.error("locales/en.json must contain a JSON object");
    process.exit(1);
  }

  const baseKeys = Object.keys(base);
  if (baseKeys.length === 0) {
    console.error("locales/en.json must contain at least one key");
    process.exit(1);
  }

  REQUIRED_CODES.forEach((code) => {
    const localePath = path.join(LOCALES_DIR, `${code}.json`);
    const dict = readJson(localePath);

    if (!dict || typeof dict !== "object" || Array.isArray(dict)) {
      console.error(`locales/${code}.json must contain a JSON object`);
      errors += 1;
      return;
    }

    const missingKeys = baseKeys.filter((key) => !(key in dict));
    if (missingKeys.length > 0) {
      console.error(`locales/${code}.json is missing keys: ${missingKeys.join(", ")}`);
      errors += 1;
    }

    const nonStringKeys = baseKeys.filter((key) => typeof dict[key] !== "string");
    if (nonStringKeys.length > 0) {
      console.error(
        `locales/${code}.json has non-string values for keys: ${nonStringKeys.join(", ")}`,
      );
      errors += 1;
    }

    const unknownKeys = Object.keys(dict).filter((key) => !baseKeys.includes(key));
    if (unknownKeys.length > 0) {
      console.error(`locales/${code}.json has unknown keys: ${unknownKeys.join(", ")}`);
      errors += 1;
    }
  });

  if (errors > 0) {
    console.error(`Locale dictionary validation failed with ${errors} error(s).`);
    process.exit(1);
  }

  console.log(
    `Locale validation passed (${REQUIRED_CODES.length} locales, ${baseKeys.length} keys each).`,
  );
}

main();
