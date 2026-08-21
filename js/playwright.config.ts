import { defineConfig } from '@playwright/test';

const configuredBaseURL = process.env.BASE_URL?.trim();
const managedBaseURL = 'http://localhost:3000';
const baseURL = configuredBaseURL || managedBaseURL;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  webServer: configuredBaseURL
    ? undefined
    : {
        command: 'node ../fixture-app/server.mjs',
        url: `${managedBaseURL}/healthz`,
        reuseExistingServer: false,
        timeout: 10_000
      },
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
