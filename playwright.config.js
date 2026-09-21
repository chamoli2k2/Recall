import { defineConfig, devices } from '@playwright/test';
const port = process.env.E2E_PORT || 4100;
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests share one in-memory database; usernames are randomised but keep runs deterministic
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: process.env.CI ? 'retain-on-failure' : 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node scripts/e2e-server.js', url: `http://localhost:${port}/api/health`, reuseExistingServer: !process.env.CI, timeout: 180_000, stdout: 'ignore', stderr: 'pipe' }
});
