import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { configRevision } from '../src/config/revision';

// El valor nunca se repite aquí ni se imprime: si falla, el mensaje no lo incluye.
const RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

describe('configRevision', () => {
  it('urlCanal es la URL /exec de un Apps Script', () => {
    expect(RE.test(configRevision.urlCanal), 'urlCanal no es una URL /exec').toBe(true);
  });
});

describe('specs e2e del modo revisión', () => {
  // Con urlCanal llena, un spec que entra en modo revisión sin la guarda saldría al script real del editor.
  it('cada spec que entra en modo revisión llama a protegerCanalReal()', () => {
    const dir = fileURLToPath(new URL('../e2e', import.meta.url));
    const sinGuarda = readdirSync(dir)
      .filter((f) => f.endsWith('.spec.ts'))
      .filter((f) => {
        const texto = readFileSync(join(dir, f), 'utf8');
        return (texto.includes('/revision') || texto.includes('atlas:revisor')) && !/^\s*protegerCanalReal\(\);/m.test(texto);
      });
    expect(sinGuarda, 'specs de modo revisión sin protegerCanalReal()').toEqual([]);
  });
});
