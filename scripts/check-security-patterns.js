#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");

const PATTERNS = [
  {
    name: "innerHTML assignment",
    regex: /\binnerHTML\s*=/,
    message: "Avoid innerHTML assignments; use createElement/textContent to prevent XSS.",
  },
  {
    name: "outerHTML assignment",
    regex: /\bouterHTML\s*=/,
    message: "Avoid outerHTML assignments; use DOM APIs instead.",
  },
  {
    name: "insertAdjacentHTML",
    regex: /\binsertAdjacentHTML\s*\(/,
    message: "Avoid insertAdjacentHTML; use DOM APIs instead.",
  },
  {
    name: "eval call",
    regex: /\beval\s*\(/,
    message: "Avoid eval for security and CSP compatibility.",
  },
  {
    name: "Function constructor",
    regex: /\bnew\s+Function\s*\(/,
    message: "Avoid Function constructor for security and CSP compatibility.",
  },
];

const getJsFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
};

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error("src/ directory is missing");
    process.exit(1);
  }

  const files = getJsFiles(SRC_DIR);
  const violations = [];

  files.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      PATTERNS.forEach((pattern) => {
        if (!pattern.regex.test(line)) return;
        violations.push({
          file: path.relative(ROOT, filePath).replace(/\\/g, "/"),
          line: index + 1,
          rule: pattern.name,
          message: pattern.message,
          source: line.trim(),
        });
      });
    });
  });

  if (violations.length > 0) {
    console.error(`Security pattern check failed with ${violations.length} violation(s):`);
    violations.forEach((item) => {
      console.error(`- ${item.file}:${item.line} [${item.rule}] ${item.message}`);
      console.error(`  ${item.source}`);
    });
    process.exit(1);
  }

  console.log(`Security pattern check passed (${files.length} JS files scanned).`);
}

main();
