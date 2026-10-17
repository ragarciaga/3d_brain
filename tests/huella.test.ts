import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { claveGuiaVista, claveRevisionIdb, huella, PREFIJO_HUELLA } from '../src/lib/huella';

const sha = (codigo: string) => createHash('sha256').update(PREFIJO_HUELLA + codigo).digest('hex');

describe('huella del código del revisor (#149, S6)', () => {
  // El prefijo mide 20 bytes: los largos 35, 36, 43, 44 y 100 llevan el mensaje a 55, 56, 63, 64 y 120 bytes
  // (los límites del relleno de SHA-256, entre uno y dos bloques) y 200 y 1000 a varios bloques.
  it.each([1, 8, 35, 36, 43, 44, 45, 100, 200, 1000])('es igual al SHA-256 de node:crypto para un código de largo %i', (largo) => {
    const codigo = 'aB3_-'.repeat(Math.ceil(largo / 5)).slice(0, largo);
    expect(huella(codigo)).toBe(sha(codigo));
    expect(huella(codigo)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el largo del prefijo es el que suponen las pruebas de relleno', () => {
    expect(PREFIJO_HUELLA).toHaveLength(20);
  });

  it('acepta caracteres fuera de ASCII como lo hace UTF-8', () => {
    expect(huella('ñandú-é')).toBe(sha('ñandú-é'));
  });

  it('las llaves llevan la huella y no el código', () => {
    for (const codigo of ['CLARO01', 'D03-ok', 'A'.repeat(40)]) {
      expect(claveRevisionIdb(codigo)).toMatch(/^revision:[0-9a-f]{64}$/);
      expect(claveGuiaVista(codigo)).toMatch(/^atlas:guia-vista:[0-9a-f]{64}$/);
      expect(claveRevisionIdb(codigo)).not.toContain(codigo);
      expect(claveGuiaVista(codigo)).not.toContain(codigo);
      expect(claveRevisionIdb(codigo)).toBe(`revision:${sha(codigo)}`);
      expect(claveGuiaVista(codigo)).toBe(`atlas:guia-vista:${sha(codigo)}`);
    }
  });

  it('son deterministas y distintas entre códigos', () => {
    expect(claveRevisionIdb('UNO01')).toBe(claveRevisionIdb('UNO01'));
    expect(claveRevisionIdb('UNO01')).not.toBe(claveRevisionIdb('DOS01'));
    expect(claveGuiaVista('UNO01')).not.toBe(claveGuiaVista('DOS01'));
  });
});
