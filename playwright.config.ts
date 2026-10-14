import { defineConfig, devices } from '@playwright/test';

// PORT lets parallel worktrees run their own app (rb worktree add prints an offset).
// E2E_BASE_URL points the suite at an app that is already running and skips webServer.
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['.explore/**'],
  // En CI, 2 workers (runner de 4 vCPU): en serie la suite llegó a 29,4 min (PR #113) frente al
  // tope de 30 min del job. Medido con 2 workers y paralelismo solo por archivo: 25,7 min, porque
  // atlas.spec.ts es el piso (19,1 min en serie, 25,7 min con la CPU compartida). Por eso en CI
  // también se reparten las pruebas de un mismo archivo (fullyParallel). En local, 1 worker y en serie.
  fullyParallel: !!process.env.CI,
  workers: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test must be classified by the healer, never passed by luck.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // El visor dibuja cerca de un millón de triángulos con WebGL por software (SwiftShader) en CI.
  timeout: 180_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      // Permite usar un Chromium ya instalado (por ejemplo /opt/pw-browsers/chromium en la nube).
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
