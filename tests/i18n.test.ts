import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clavesFaltantes, diferencias } from '../scripts/lib/i18n.ts';

describe('textos de los botones de revisión', () => {
  const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) as { revision: Record<string, string> };
  it('"Correct" y la acción de corregir no se confunden en inglés', () => {
    const { correcto, corregir } = en.revision;
    expect(corregir!.startsWith(correcto!)).toBe(false);
    expect(corregir).toBe('Suggest a fix');
  });
});

describe('check:i18n', () => {
  it('detecta una clave que solo existe en un idioma', () => {
    const d = diferencias({ a: { b: 'x', c: 'y' } }, { a: { b: 'x' } });
    expect(d.soloA).toEqual(['a.c']);
    expect(d.soloB).toEqual([]);
  });

  it('detecta textos vacíos', () => {
    expect(diferencias({ a: ' ' }, { a: 'x' }).vacias).toEqual(['a']);
  });

  it('detecta claves usadas en el código que no existen, aceptando plurales', () => {
    const codigo = "t('a.b'); t('visor.piezas', { count: 2 }); t('no.existe')";
    expect(clavesFaltantes(codigo, { a: { b: 'x' }, visor: { piezas_one: 'p', piezas_other: 'ps' } })).toEqual(['no.existe']);
  });
});
