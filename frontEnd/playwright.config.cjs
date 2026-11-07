const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.cjs',
  timeout: 90000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node e2e/server.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
