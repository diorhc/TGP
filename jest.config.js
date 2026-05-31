/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  collectCoverageFrom: ["src/pure.js"],
  coverageDirectory: "coverage",
  verbose: true,
};
