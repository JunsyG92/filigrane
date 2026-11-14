import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  },
  // Teste le build statique réel (celui qui serait déployé), pas le serveur de dev.
  webServer: {
    command: `npm run build && PORT=${PORT} node scripts/serve-out.mjs`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
