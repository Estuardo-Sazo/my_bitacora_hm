import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    locale: 'es-GT',
    timezoneId: 'America/Guatemala',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Phones are the main device, so their flows also run on Safari's engine.
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] }, grep: /on a phone/ },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Blank values override a developer's .env.local: this server is the demo-only build.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_AUTH_GOOGLE: '' },
    },
    {
      // Same app with sign-in turned on, using placeholder values that reach no real project.
      command:
        'npx vite build --outDir dist-supabase && npx vite preview --outDir dist-supabase --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
        VITE_AUTH_GOOGLE: 'true',
      },
    },
  ],
});
