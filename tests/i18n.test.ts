import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clavesFaltantes, diferencias } from '../scripts/lib/i18n.ts';

// Lo que la guía "Cómo revisar" no puede decir en ningún modo (R10.3): registro, pasos de envío, el formulario ni el respaldo.
// "formulario" y "form" van como palabra completa para no atrapar "información", "formato" ni "information".
const PROHIBIDO_EN_LA_GUIA = {
  es: /regist|\bformulario\b|respaldo|enviar revisión|enviar todo|sí, lo envié/i,
  en: /regist|\bform\b|backup|send review|send all|yes, i sent it/i,
} as const;

describe('textos de los botones de revisión', () => {
  const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) as { revision: Record<string, string> };
  it('"Correct" y la acción de corregir no se confunden en inglés', () => {
    const { correcto, corregir } = en.revision;
    expect(corregir!.startsWith(correcto!)).toBe(false);
    expect(corregir).toBe('Suggest a fix');
  });

  type Revision = Record<string, string> & { guia: Record<string, string>; guardado: Record<string, string> };
  for (const idioma of ['es', 'en'] as const) {
    it(`los estados del guardado (${idioma}) existen y dicen los textos del spec`, () => {
      const { guardado } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')).revision as Revision;
      if (idioma === 'es') {
        expect(guardado.guardando).toBe('Guardando...');
        expect(guardado.listo).toBe('Guardado ✓');
        expect(guardado.sinConexion).toBe('Sin conexión: se guardará cuando vuelva');
        expect(guardado.inactivo).toBe('Tu código no está activo; escribe al editor');
      } else {
        for (const clave of ['guardando', 'listo', 'sinConexion', 'inactivo']) expect(guardado[clave]?.trim()).toBeTruthy();
        expect(guardado.listo).toContain('✓');
      }
    });

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

    it(`la guía (${idioma}) ya no tiene el paso de envío`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.enviarTodo).toBeTruthy();
      expect(revision.loEnvie).toBeTruthy();
      expect(Object.hasOwn(revision.guia, 'intro')).toBe(true);
      expect(Object.hasOwn(revision.guia, 'enviar')).toBe(false);
      for (const [clave, valor] of Object.entries(revision.guia)) {
        expect(valor, clave).not.toContain(revision.enviarTodo);
        expect(valor, clave).not.toContain(revision.loEnvie);
        expect(valor, clave).not.toContain(revision.enviar);
      }
    });

    it(`la guía (${idioma}) no menciona registro, envío, formulario ni respaldo`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      // La guía tiene que existir de verdad: un objeto vacío pasaría todos los filtros de abajo.
      for (const clave of ['intro', 'guardado', 'otroEquipo', 'privacidad']) {
        expect(revision.guia[clave]?.trim(), clave).toBeTruthy();
      }
      const botones = [revision.enviar, revision.enviarTodo, revision.loEnvie, revision.abrirFormulario, revision.enviarPorFormulario];
      for (const [clave, valor] of Object.entries(revision.guia)) {
        expect(valor, clave).not.toMatch(PROHIBIDO_EN_LA_GUIA[idioma]);
        for (const boton of botones) expect(valor, `${clave} contiene "${boton}"`).not.toContain(boton);
      }
    });

    it(`registrarme vive fuera de la guía con el mismo texto (${idioma})`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(Object.hasOwn(revision.guia, 'registrarme')).toBe(false);
      expect(revision.registrarme).toBe(idioma === 'es' ? 'Registrarme (una sola vez)' : 'Register (once)');
    });

    it(`la guía (${idioma}) dice Guardado, Sin conexión y que se sigue en otro equipo con el mismo enlace`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      const { guardado, otroEquipo } = revision.guia;
      expect(revision.guardado.listo).toBe(idioma === 'es' ? 'Guardado ✓' : 'Saved ✓');
      expect(guardado).toContain(revision.guardado.listo);
      expect(guardado).toContain(revision.guardado.sinConexion);
      if (idioma === 'es') {
        expect(guardado).toContain('Guardado');
        expect(otroEquipo).toContain('otro equipo');
        expect(otroEquipo).toContain('mismo enlace');
      } else {
        expect(guardado).toContain('Saved');
        expect(otroEquipo).toContain('another device');
        expect(otroEquipo).toContain('same link');
      }
    });

    it(`la privacidad de la guía (${idioma}) no promete el nombre y nombra la etiqueta de la ficha`, () => {
      const root = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { ficha: Record<string, string>; revision: Revision };
      const { privacidad } = root.revision.guia;
      expect(root.ficha.revisadoDocente).toBeTruthy();
      expect(privacidad).toContain(root.ficha.revisadoDocente);
      expect(privacidad).toContain('1581');
      // Las propuestas y los comentarios se publican con el alias en los issues públicos: la guía lo avisa.
      expect(privacidad).toContain(idioma === 'es' ? 'issues públicos' : 'public issues');
      expect(privacidad).toContain('alias');
      expect(privacidad).not.toMatch(idioma === 'es' ? /tu nombre (solo )?aparece/i : /your name (only )?appears/i);
    });

    it(`vagoCasilla (${idioma}) nombra la casilla y Acciones tal como aparecen`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision & { autorizacion: Record<string, string> } };
      expect(revision.autorizacion.vago).toBeTruthy();
      expect(revision.acciones).toBeTruthy();
      expect(revision.guia.vagoCasilla).toContain(revision.autorizacion.vago);
      expect(revision.guia.vagoCasilla).toContain(revision.acciones);
      if (idioma === 'es') expect(revision.guia.vagoCasilla).toContain('solo aparecen si marcas');
    });

    it(`confirmaAyudaCanal (${idioma}) nombra el botón y dice que no hay que enviar otra vez`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.confirmaAyudaCanal).toContain(revision.loEnvie);
      expect(revision.confirmaAyudaCanal).toContain(idioma === 'es' ? 'no tienes que enviarlas otra vez' : 'you do not need to send them again');
    });

    it(`el aviso local (${idioma}) dice que las respuestas se guardan solo en este navegador y no invita a descargar`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.soloEsteNavegador).toContain(idioma === 'es' ? 'solo en este navegador' : 'only in this browser');
      expect(revision.soloEsteNavegador).not.toMatch(idioma === 'es' ? /descarg|respaldo/i : /download|backup/i);
      expect(revision.guia.responder).not.toMatch(idioma === 'es' ? /descarg|respaldo/i : /download|backup/i);
    });

    it(`las claves del respaldo por archivo (${idioma}) ya no existen`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      for (const clave of [
        'descargarRespaldo',
        'cargarRespaldo',
        'respaldoCargado',
        'respaldoOmitidas_one',
        'respaldoOmitidas_other',
        'respaldoErrorArchivo',
        'respaldoErrorVersion',
        'respaldoErrorRevisor',
      ]) {
        expect(Object.hasOwn(revision, clave), clave).toBe(false);
      }
    });

    it(`la confirmación de salida (${idioma}) dice que las respuestas quedan guardadas en el navegador`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.salirTexto).toContain(idioma === 'es' ? 'quedan guardadas en este navegador' : 'stay saved in this browser');
    });

    it(`el título de la confirmación (${idioma}) nombra la acción del botón`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      expect(revision.salirTitulo!.toLowerCase()).toContain(revision.salir!.toLowerCase());
    });

    it(`el consentimiento del envío (${idioma}) remite al registro, dice que las fichas no muestran el nombre y no usa los textos viejos`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      const { consentimiento } = revision;
      if (idioma === 'es') {
        expect(consentimiento).toContain('Las fichas no muestran tu nombre');
        expect(consentimiento).toContain('regístrate una sola vez');
        expect(consentimiento).toContain('en un solo formulario');
        expect(consentimiento).not.toMatch(/tu nombre aparece|aparece como revisor|solo si lo autorizaste/i);
      } else {
        expect(consentimiento).toContain('The entries never show your name');
        expect(consentimiento).toContain('register once');
        expect(consentimiento).toContain('in a single form');
        expect(consentimiento).not.toMatch(/your name appears|appears as reviewer|only if you authorised it/i);
      }
      for (const vieja of [
        'Al enviar, aceptas',
        'Se envía una revisión por estructura',
        'By sending, you agree',
        'One review is sent per structure',
        'Cada ficha de la lista se envía por separado',
        'Each entry in the list is sent separately',
        'solo si lo autorizaste en el registro',
        'only if you authorised it in the registration form',
      ]) {
        expect(consentimiento).not.toContain(vieja);
      }
    });

    it(`el respaldo por formulario (${idioma}) se llama como en el spec`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      if (idioma === 'es') expect(revision.enviarPorFormulario).toBe('Enviar por formulario');
      else expect(revision.enviarPorFormulario?.trim()).toBeTruthy();
      expect(revision.respaldoExplica?.trim()).toBeTruthy();
    });
  }
});

describe('filtros de palabra de la guía', () => {
  it('no confunden información, formato ni information, y sí atrapan formulario y form', () => {
    expect('información formato').not.toMatch(PROHIBIDO_EN_LA_GUIA.es);
    expect('information format').not.toMatch(PROHIBIDO_EN_LA_GUIA.en);
    expect('el formulario').toMatch(PROHIBIDO_EN_LA_GUIA.es);
    expect('the form').toMatch(PROHIBIDO_EN_LA_GUIA.en);
    expect('Registrarme').toMatch(PROHIBIDO_EN_LA_GUIA.es);
    expect('Register').toMatch(PROHIBIDO_EN_LA_GUIA.en);
    expect('un respaldo').toMatch(PROHIBIDO_EN_LA_GUIA.es);
    expect('a backup').toMatch(PROHIBIDO_EN_LA_GUIA.en);
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
