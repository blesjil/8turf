import { defineConfig, devices } from '@playwright/test';

const port = 3101;
const baseURL = `http://localhost:${port}`;
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:54342/8turf_e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `bun run test:e2e:setup && bun run --bun next dev --webpack --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      NEXT_DIST_DIR: '.next-e2e',
      DATABASE_URL: databaseURL,
      BETTER_AUTH_SECRET: '8turf-e2e-secret-at-least-32-characters',
      BETTER_AUTH_URL: baseURL,
      GMAIL_USER: '',
      GMAIL_APP_PASSWORD: '',
      GOOGLE_DRIVE_CLIENT_ID: '',
      GOOGLE_DRIVE_CLIENT_SECRET: '',
      GOOGLE_DRIVE_REFRESH_TOKEN: '',
      SEMAPHORE_API_KEY: '',
      SEMAPHORE_SENDER_NAME: '',
    },
  },
});
