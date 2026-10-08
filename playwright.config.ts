import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 60_000,
  use: { baseURL: 'https://127.0.0.1:4173/Web-Album/', ignoreHTTPSErrors: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [{
    command: 'npm run preview -- --outDir .discovery-build --port 4173 --strictPort',
    url: 'https://127.0.0.1:4173/Web-Album/',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
  }, {
    command: 'npm run preview -- --port 4174 --strictPort',
    url: 'https://127.0.0.1:4174/Web-Album/',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
  }],
});
