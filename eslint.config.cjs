"use strict";

const js = require("@eslint/js");
const globals = require("globals");
const bundleGlobals = require("./scripts/eslint-globals.cjs");

module.exports = [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...bundleGlobals,
      },
    },
    rules: {
      // src/*.js are concatenation fragments; top-level declarations are shared
      // across files, so no-unused-vars gives false positives per file.
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "no-redeclare": "off",
      "prefer-const": "warn",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["scripts/**/*.js", "test/**/*.js", "jest.config.js", "build.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    files: ["src/pure.js", "src/lib/**/*.js"],
    languageOptions: {
      globals: { module: "readonly" },
    },
  },
  {
    ignores: [
      "telegram.user.js",
      "telegram.min.user.js",
      "node_modules/**",
      "coverage/**",
      "dist/**",
    ],
  },
];
