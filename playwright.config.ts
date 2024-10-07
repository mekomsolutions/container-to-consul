import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  use: {
    // All requests we send go to this API endpoint.
    baseURL: 'http://localhost:8080',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    timeout: 120000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ]
});