import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No se importa el @playwright/test real: Vitest y Playwright registran matchers globales de
// `expect` y pueden chocar. Basta con que defineConfig devuelva lo que recibe.
vi.mock('@playwright/test', () => ({
  defineConfig: (c: unknown) => c,
  devices: { 'Desktop Chrome': {} },
}));

type ConfigE2E = {
  workers: number;
  fullyParallel: boolean;
  retries: number;
  timeout: number;
  expect: { timeout: number };
  webServer: { timeout: number } | undefined;
};

const VARIABLES = ['CI', 'E2E_BASE_URL'] as const;
const guardadas: Record<string, string | undefined> = {};

// `ci === undefined` borra la variable (no la deja en ''), igual que un equipo local.
async function cargar(ci: string | undefined): Promise<ConfigE2E> {
  if (ci === undefined) delete process.env.CI;
  else process.env.CI = ci;
  vi.resetModules();
  const modulo = await import('../playwright.config.ts');
  return modulo.default as unknown as ConfigE2E;
}

describe('playwright.config', () => {
  beforeEach(() => {
    for (const nombre of VARIABLES) {
      guardadas[nombre] = process.env[nombre];
    }
    // Con E2E_BASE_URL definida, webServer sale undefined.
    delete process.env.E2E_BASE_URL;
  });

  afterEach(() => {
    for (const nombre of VARIABLES) {
      const valor = guardadas[nombre];
      if (valor === undefined) delete process.env[nombre];
      else process.env[nombre] = valor;
    }
  });

  it('en CI usa 2 workers', async () => {
    expect((await cargar('true')).workers).toBe(2);
  });

  it('fuera de CI usa 1 worker', async () => {
    expect((await cargar(undefined)).workers).toBe(1);
  });

  it('en CI reparte también las pruebas de un mismo archivo (fullyParallel)', async () => {
    expect((await cargar('true')).fullyParallel).toBe(true);
  });

  it('fuera de CI corre en serie (sin fullyParallel)', async () => {
    expect((await cargar(undefined)).fullyParallel).toBe(false);
  });

  it.each([
    ['en CI', 'true'],
    ['fuera de CI', undefined],
  ])(
    'no cambia los reintentos ni los tiempos de espera %s',
    async (_modo, ci) => {
      const config = await cargar(ci);
      expect(config.retries).toBe(0);
      expect(config.timeout).toBe(180_000);
      expect(config.expect.timeout).toBe(60_000);
      expect(config.webServer?.timeout).toBe(120_000);
    },
  );
});
