import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./reviewer",
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "artifacts/reviewer-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    locale: "en-GB",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "PYTHONPATH=../../services/api/src ../../services/api/.venv/bin/uvicorn supplier_compliance_api.reviewer:app --host 127.0.0.1 --port 8011", url: "http://127.0.0.1:8011/openapi.json", reuseExistingServer: false },
    { command: "npm run dev --prefix ../../apps/web", url: "http://127.0.0.1:5174/reviewer.html", reuseExistingServer: false },
    { command: "node ../../scripts/reviewer-render-lab.mjs --generate && node ../../scripts/reviewer-render-lab.mjs", url: "http://127.0.0.1:5188/render/ssr", reuseExistingServer: false },
  ],
});
