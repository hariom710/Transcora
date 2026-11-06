import { defineConfig } from "@playwright/test";

// E2E runs against the real dev servers; reuseExistingServer keeps a manual
// `npm run dev` / uvicorn session (the normal dev setup) in play.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: ".venv\\Scripts\\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "..\\backend",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: true,
      timeout: 120_000,
      env: { DATABASE_URL: "sqlite:///./shares.db" },
    },
  ],
});
