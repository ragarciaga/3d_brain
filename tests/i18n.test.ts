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

  type Revision = Record<string, string> & { guia: Record<string, string> };
  for (const idioma of ['es', 'en'] as const) {
    it(`la guía (${idioma}) nombra los botones tal como aparecen`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      const { responder } = revision.guia;
      expect(responder).toContain(revision.correcto);
      expect(responder).toContain(revision.corregir);
      expect(responder).toContain(revision.no_es_mi_area);
      if (idioma === 'en') {
        expect(responder).not.toContain('Correct it');
        expect(responder).not.toContain('Not my area');
      }
    });

    it(`la guía (${idioma}) nombra "Marcar todo como correcto" tal como aparece`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.marcarTodo).toBeTruthy();
      expect(revision.guia.responder).toContain(revision.marcarTodo);
    });

    it(`la guía (${idioma}) nombra "Enviar todo" y "Sí, lo envié" tal como aparecen`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.enviarTodo).toBeTruthy();
      expect(revision.loEnvie).toBeTruthy();
      expect(revision.guia.enviar).toContain(revision.enviarTodo);
      expect(revision.guia.enviar).toContain(revision.loEnvie);
    });

    it(`el aviso del respaldo (${idioma}) dice que las respuestas se guardan solo en este navegador`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.soloEsteNavegador).toContain(idioma === 'es' ? 'solo en este navegador' : 'only in this browser');
    });

    it(`la guía (${idioma}) nombra los botones del respaldo tal como aparecen`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.descargarRespaldo).toBeTruthy();
      expect(revision.cargarRespaldo).toBeTruthy();
      expect(revision.guia.responder).toContain(revision.descargarRespaldo);
      expect(revision.guia.responder).toContain(revision.cargarRespaldo);
    });

    it(`la confirmación de salida (${idioma}) dice que las respuestas quedan guardadas en el navegador`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.salirTexto).toContain(idioma === 'es' ? 'quedan guardadas en este navegador' : 'stay saved in this browser');
    });

    it(`el título de la confirmación (${idioma}) nombra la acción del botón`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.salirTitulo!.toLowerCase()).toContain(revision.salir!.toLowerCase());
    });

    it(`el consentimiento del envío (${idioma}) remite al registro y no usa los textos viejos`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      const { consentimiento } = revision;
      expect(consentimiento).toContain(idioma === 'es' ? 'solo si lo autorizaste en el registro' : 'only if you authorised it in the registration form');
      for (const vieja of ['Al enviar, aceptas', 'Se envía una revisión por estructura', 'By sending, you agree', 'One review is sent per structure', 'Cada ficha de la lista se envía por separado', 'Each entry in the list is sent separately']) {
        expect(consentimiento).not.toContain(vieja);
      }
    });
  }
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
