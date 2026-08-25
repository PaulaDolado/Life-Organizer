/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  // Carga .env.test (BD de pruebas, distinta de la de desarrollo) antes que nada — ver
  // tests/setupEnv.ts para el porqué.
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts"],
  coverageDirectory: "coverage",
  clearMocks: true,
  verbose: true,
};
