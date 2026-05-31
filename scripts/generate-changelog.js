#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");

const TYPE_LABEL = {
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactor",
  docs: "Docs",
  test: "Tests",
  chore: "Chore",
};

const runGit = (command) => {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const getLastTag = () => runGit("git describe --tags --abbrev=0");

const getCommits = (sinceTag) => {
  const range = sinceTag ? `${sinceTag}..HEAD` : "HEAD";
  const raw = runGit(`git log ${range} --pretty=format:%s`);
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseCommit = (subject) => {
  const match = subject.match(/^(\w+)(?:\([^)]*\))?:\s+(.+)$/);
  if (!match) return { type: "chore", text: subject };
  const type = match[1].toLowerCase();
  return { type: TYPE_LABEL[type] ? type : "chore", text: match[2] };
};

const main = () => {
  if (!fs.existsSync(CHANGELOG)) {
    console.error("CHANGELOG.md is missing");
    process.exit(1);
  }

  const lastTag = getLastTag();
  const commits = getCommits(lastTag);
  if (commits.length === 0) {
    console.log("No new commits for changelog.");
    process.exit(0);
  }

  const groups = new Map();
  commits.forEach((subject) => {
    const parsed = parseCommit(subject);
    const key = TYPE_LABEL[parsed.type] ? parsed.type : "chore";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(`- ${parsed.text}`);
  });

  const date = new Date().toISOString().slice(0, 10);
  const unreleasedHeader = `## [Unreleased] - ${date}`;
  const section = [unreleasedHeader, ""];
  Object.keys(TYPE_LABEL).forEach((type) => {
    const entries = groups.get(type);
    if (!entries || entries.length === 0) return;
    section.push(`### ${TYPE_LABEL[type]}`);
    section.push(...entries);
    section.push("");
  });

  const content = fs.readFileSync(CHANGELOG, "utf8");
  const lines = content.split(/\r?\n/);
  const insertIndex = lines.findIndex(
    (line) => /^##\s+\[?\d/.test(line) || /^##\s+\[Unreleased\]/.test(line),
  );
  const targetIndex = insertIndex === -1 ? lines.length : insertIndex;
  const updated = [...lines.slice(0, targetIndex), ...section, ...lines.slice(targetIndex)].join(
    "\n",
  );

  fs.writeFileSync(CHANGELOG, `${updated.replace(/\n{3,}/g, "\n\n")}\n`, "utf8");
  console.log(`Changelog updated from ${commits.length} commit(s).`);
};

main();
