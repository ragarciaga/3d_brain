import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';
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

    it(`el texto de autorización (${idioma}) avisa que las propuestas y comentarios se publican con el alias, nunca con el nombre (#162)`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: { autorizacion: Record<string, string> } };
      const texto = revision.autorizacion.texto!;
      expect(texto).toContain('alias');
      expect(texto).toContain(idioma === 'es' ? 'issues públicos' : 'public issues');
      expect(texto).toContain(idioma === 'es' ? 'nunca tu nombre' : 'never your name');
      expect(texto).toContain(idioma === 'es' ? 'propuestas y comentarios' : 'proposals and comments');
      expect(texto).toContain('1581');
      expect(texto).not.toContain('—');
      if (idioma === 'es') expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribís/i);
    });

    it(`el texto de autorización (${idioma}) nombra al responsable y el contacto (#168)`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: { autorizacion: Record<string, string> } };
      const texto = revision.autorizacion.texto!;
      expect(texto).toContain('Maysa Strategy Partners');
      expect(texto).toContain('info@maysasp.com');
      expect(texto).toContain(idioma === 'es' ? 'casilla del nervio vago' : 'vagus nerve checkbox');
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

    it(`la salida (${idioma}) ofrece "Borrar también de este equipo" y advierte de historial, Descargas, formulario y portapapeles`, () => {
      const { revision } = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as { revision: Revision };
      const ayuda = revision.salirBorrarAyuda!;
      if (idioma === 'es') {
        expect(revision.salirBorrar).toBe('Borrar también de este equipo');
        for (const parte of ['historial', 'Descargas', 'formulario de Google', 'portapapeles', 'ventana privada']) expect(ayuda, parte).toContain(parte);
        expect(ayuda).toMatch(/No borra[^:]*historial[^:]*Descargas[^:]*portapapeles/);
        expect(ayuda).toMatch(/ventana privada[^.]*tampoco borra las descargas ni el portapapeles/);
      } else {
        expect(revision.salirBorrar).toBe('Also delete from this device');
        for (const parte of ['history', 'Downloads', 'Google Form', 'clipboard', 'private window']) expect(ayuda, parte).toContain(parte);
        expect(ayuda).toMatch(/does not delete your link from the browser history[^:]*Downloads[^:]*clipboard/);
        expect(ayuda).toMatch(/private window[^.]*does not delete the downloads or the clipboard either/);
      }
      expect(revision.bloqueadaBeacon?.trim()).toBeTruthy();
      if (idioma === 'es') expect(revision.bloqueadaBeacon).toContain('No pudimos abrir el modo revisión en esta pestaña');
      for (const clave of ['salirBorrar', 'salirBorrarAyuda', 'bloqueadaBeacon']) {
        expect(revision[clave], clave).not.toMatch(/irreversible|no se puede recuperar|cannot be recovered|secret/i);
        expect(revision[clave], clave).not.toContain('\u2014');
      }
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

describe('página Privacidad (#168)', () => {
  const CLAVES = [
    'enlace', 'leer', 'titulo', 'intro', 'actualizado',
    'responsableTitulo', 'responsable', 'visitasTitulo', 'visitas', 'alojamiento',
    'revisionTitulo', 'revision', 'respaldo', 'publicacion', 'reportesTitulo', 'reportes',
    'finalidadesTitulo', 'finalidades', 'baseTitulo', 'base',
    'proveedoresTitulo', 'proveedorCloudflare', 'proveedorGoogle', 'proveedorGithub', 'proveedorHostinger', 'transferencia',
    'conservacionTitulo', 'conservacionRevision', 'conservacionReportes', 'conservacionProveedores',
    'derechosTitulo', 'derechos', 'autoridad', 'cookiesTitulo', 'cookies', 'volver',
  ];
  const pagina = readFileSync('src/components/Privacidad.tsx', 'utf8');

  for (const idioma of ['es', 'en'] as const) {
    const raiz = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as {
      ficha: Record<string, string>;
      revision: { autorizacion: Record<string, string> };
      privacidad: Record<string, string>;
    };
    const p = raiz.privacidad;
    const todo = Object.values(p).join('\n');
    const dice = (clave: string, ...partes: string[]) => {
      for (const parte of partes) expect(p[clave], `${clave} debe contener "${parte}"`).toContain(parte);
    };
    const es = idioma === 'es';

    it(`(${idioma}) las claves de privacidad son exactamente las acordadas`, () => {
      expect(Object.keys(p).sort()).toEqual([...CLAVES].sort());
    });

    it(`(${idioma}) toda clave de contenido se pinta en Privacidad.tsx`, () => {
      for (const clave of CLAVES.filter((c) => c !== 'enlace' && c !== 'leer')) {
        expect(pagina, clave).toContain(`t('privacidad.${clave}')`);
      }
    });

    it(`(${idioma}) nombra al responsable y el contacto`, () => {
      dice('responsable', 'Maysa Strategy Partners', 'info@maysasp.com');
    });

    it(`(${idioma}) dice qué recoge Cloudflare de los visitantes y que no usa cookies`, () => {
      dice('visitas', 'Cloudflare', 'referrer', 'cookies', ...(es ? ['dirección IP', 'agente de usuario'] : ['IP address', 'user agent']));
    });

    it(`(${idioma}) el aviso del conteo vale por página y no promete lo que no cumple (#149)`, () => {
      const v = p['visitas']!;
      if (es) {
        expect(v).toContain(
          'Este conteo no se carga en las páginas que abres en modo revisión ni mientras tu navegador recuerde tu código. Una página del atlas que ya estaba abierta antes de abrir tu enlace de revisión puede enviar su conteo, también al cerrarla o recargarla.',
        );
        expect(v).not.toMatch(/está o estuvo|mientras tu navegador esté en modo revisión/);
      } else {
        expect(v).toContain(
          'This counting is not loaded on pages you open in review mode or while your browser remembers your code. An atlas page that was already open before you opened your review link may send its count, including when you close or reload it.',
        );
        expect(v).not.toMatch(/is or was|while your browser is in review mode/);
      }
      expect(v).not.toMatch(/irreversible|no se puede recuperar|cannot be recovered/i);
    });

    it(`(${idioma}) dice qué recoge de los revisores y cómo se publica`, () => {
      dice('revision', ...(es ? ['código de revisor', 'fecha y hora', 'casilla del nervio vago'] : ['reviewer code', 'date and time', 'vagus nerve checkbox']));
      expect(p['revision']).toContain(raiz.ficha['revisadoDocente']!);
      dice('publicacion', 'alias', es ? 'issues públicos' : 'public issues');
    });

    it(`(${idioma}) dice qué pasa con un reporte (F12)`, () => {
      // Frases que cargan la afirmación: "public" también está en "published" y la dirección sale dos veces
      // (destino del correo y pedido de borrado), así que se fijan con el verbo o el adjetivo que las acompaña.
      dice('reportes', 'GitHub', 'info@maysasp.com');
      dice(
        'reportes',
        ...(es
          ? ['issue público', 'llega a info@maysasp.com', 'la app no guarda', 'se abre el formulario de GitHub ya lleno', 'cuando lo envías con tu cuenta']
          : ['public issue', 'reaches info@maysasp.com', 'the app does not save', "GitHub's form opens already filled in", 'when you send it with your account']),
      );
    });

    it(`(${idioma}) dice las finalidades, la base, los proveedores y la transferencia`, () => {
      dice('finalidades', es ? 'analítica' : 'Analytics', es ? 'reportes de error' : 'Error reports');
      dice('base', ...(es ? ['interés legítimo', 'autorización', 'Un reporte lo envías tú', 'al enviarlo autorizas que usemos lo que escribes'] : ['legitimate interest', 'authorization', 'You send a report yourself', 'by sending it you authorize us to use what you write']));
      dice('proveedorCloudflare', 'Cloudflare');
      dice('proveedorGoogle', 'Google');
      dice('proveedorGithub', 'GitHub');
      dice('proveedorHostinger', 'Hostinger', 'info@maysasp.com', es ? 'donde llegan los reportes' : 'where reports');
      dice('transferencia', es ? 'Estados Unidos' : 'United States', 'Hostinger', es ? 'Chipre' : 'Cyprus', es ? 'fuera de Colombia' : 'outside Colombia');
    });

    it(`(${idioma}) dice cuánto se conservan los reportes y quién puede borrar los issues`, () => {
      dice('conservacionReportes', ...(es ? ['como máximo 12 meses', 'solo el editor puede borrarlos'] : ['for at most 12 months', 'only the editor can delete them']));
      dice('conservacionProveedores', 'Hostinger', es ? 'siguen el plazo de 12 meses' : 'follow the 12-month limit');
    });

    it(`(${idioma}) dice la conservación y los derechos`, () => {
      // La frase completa: "hasta que pidas" también aparece en la segunda oración (issues públicos).
      dice('conservacionRevision', es ? 'se conservan hasta que pidas borrarlas' : 'are kept until you ask for them to be deleted');
      dice('derechos', 'info@maysasp.com', ...(es ? ['conocer', 'corregir', 'borrar', 'oponerte'] : ['access', 'correct', 'delete', 'object']));
      dice('cookies', es ? 'cookies de rastreo' : 'tracking cookies');
    });

    it(`(${idioma}) no lleva guion largo, URL del canal, alias ni voseo, y ningún título termina en "revisor" con nombre`, () => {
      const textos = [todo, raiz.revision.autorizacion['texto']!];
      for (const texto of textos) {
        expect(texto).not.toContain('—');
        expect(texto).not.toContain('/exec');
        expect(texto).not.toContain('script.google.com');
        if (es) expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribís/i);
      }
      expect(todo).not.toMatch(/\bD\d{2}\b/);
      // Misma regla que F7-E1 (e2e/verificar-canal.spec.ts): una vista pública no puede decir "revisor" seguido de un nombre.
      expect(todo.replace(/\n/g, ' ')).not.toMatch(/\b(?:[Rr]evisor(?:a|es)?|[Rr]eviewers?)\s*:?\s+\p{Lu}\p{Ll}+/u);
    });
  }
});

/**
 * Busca texto visible escrito en duro en un archivo TSX, recorriendo el AST (una regex confunde genéricos,
 * flechas y comentarios con texto JSX). Marca: `JsxText` con letras o dígitos (sin entidades), hijos
 * `{...}` de un elemento cuyo valor pintado es un literal, y los atributos de texto visible
 * (`aria-label`, `placeholder`, `title`, `alt`) con un literal. El valor pintado de una expresión es ella
 * misma, las dos ramas de un ternario, el lado derecho de `&&`, `||` y `??`, y los paréntesis.
 */
function textosEnDuro(codigo: string): { literales: string[]; elementosJsx: number } {
  const fuente = ts.createSourceFile('x.tsx', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const literales: string[] = [];
  let elementosJsx = 0;
  const conLetras = (texto: string) => /[\p{L}\p{N}]/u.test(texto);
  const ATRIBUTOS = new Set(['aria-label', 'placeholder', 'title', 'alt']);

  const pintado = (e: ts.Expression): string[] => {
    if (ts.isParenthesizedExpression(e)) return pintado(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return conLetras(e.text) ? [e.text] : [];
    if (ts.isTemplateExpression(e)) {
      const fijo = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join('');
      return conLetras(fijo) ? [fijo] : [];
    }
    if (ts.isConditionalExpression(e)) return [...pintado(e.whenTrue), ...pintado(e.whenFalse)];
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        return pintado(e.right);
      }
    }
    return [];
  };

  const visitar = (nodo: ts.Node): void => {
    if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo)) elementosJsx++;
    if (ts.isJsxText(nodo)) {
      const sinEntidades = nodo.text.replace(/&\w+;|&#\d+;/g, '');
      if (conLetras(sinEntidades)) literales.push(nodo.text.trim());
    } else if (ts.isJsxExpression(nodo) && nodo.expression && (ts.isJsxElement(nodo.parent) || ts.isJsxFragment(nodo.parent))) {
      literales.push(...pintado(nodo.expression));
    } else if (ts.isJsxAttribute(nodo) && nodo.initializer && ATRIBUTOS.has(nodo.name.getText(fuente))) {
      const valor = nodo.initializer;
      if (ts.isStringLiteral(valor)) {
        if (conLetras(valor.text)) literales.push(valor.text);
      } else if (ts.isJsxExpression(valor) && valor.expression) {
        literales.push(...pintado(valor.expression));
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return { literales, elementosJsx };
}

describe('sin textos en duro en ReportarError.tsx (F12, R8.1)', () => {
  const casos: Array<[string, string, string[]]> = [
    ['texto suelto', '<p>Hola</p>', ['Hola']],
    ['literal entre llaves', "<p>{'Hola'}</p>", ['Hola']],
    ['plantilla con letras fijas', '<p>{`Hola ${n}`}</p>', ['Hola ']],
    ['rama literal de un ternario', "<p>{x ? 'Sí' : t('a')}</p>", ['Sí']],
    ['rama literal al final de un ternario', "<p>{x ? t('a') : 'No'}</p>", ['No']],
    ['lado derecho de &&', "<p>{x && 'Falta'}</p>", ['Falta']],
    ['aria-label', '<button aria-label="Cerrar" />', ['Cerrar']],
    ['placeholder', '<input placeholder="Escribe" />', ['Escribe']],
    ['title entre llaves', "<a title={'Abrir'} />", ['Abrir']],
    ['alt', '<img alt="Foto" />', ['Foto']],
  ];
  for (const [nombre, jsx, esperado] of casos) {
    it(`marca ${nombre}`, () => {
      expect(textosEnDuro(`const a = (${jsx});`).literales).toEqual(esperado);
    });
  }

  it('no marca llamadas a t(), atributos técnicos, genéricos, flechas, comentarios ni entidades', () => {
    const limpio = [
      '// Reportar un error',
      'function F() {',
      '  const boton = useRef<HTMLButtonElement>(null);',
      '  return (',
      '    <div className="aviso-caja reporte-caja" data-testid="dialogo-reporte" aria-labelledby="reporte-titulo">',
      '      {/* Cerrar */}',
      "      <button type=\"button\" onClick={() => setAbierto(true)} aria-label={t('reporte.cerrar')}>&nbsp;</button>",
      '      <a target="_blank" rel="noopener noreferrer" href={enlaceGithub(r, t)}>',
      "        {t('reporte.correoTexto', { correo: CORREO_REPORTES })}",
      '      </a>',
      "      {tipo === 'contenido' && <p>{t('x')}</p>}",
      "      <label>{t('a')}{' '}{t('b')}</label>",
      '      <span>{n} / {MAX_DESCRIPCION}</span>',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    const r = textosEnDuro(limpio);
    expect(r.literales).toEqual([]);
    expect(r.elementosJsx).toBeGreaterThan(0);
  });

  it('el archivo real no trae textos en duro', () => {
    const ruta = 'src/components/ReportarError.tsx';
    expect(existsSync(ruta)).toBe(true);
    const r = textosEnDuro(readFileSync(ruta, 'utf8'));
    expect(r.literales).toEqual([]);
    // Sin esto la prueba pasaría sin haber parseado JSX.
    expect(r.elementosJsx).toBeGreaterThan(0);
  });
});

describe('textos de los retiros (#217)', () => {
  type Textos = { revision: Record<string, string> & { guia: Record<string, string> } };
  const leer = (idioma: 'es' | 'en') => JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as Textos;
  // La hoja solo agrega filas y no se suprime desde la app: ningún texto puede sugerir que quitar una marca borra datos personales.
  const SUGIERE_BORRADO = { es: /borr|elimin|suprim|datos personales/i, en: /delet|erase|remov\w+ your data|personal data/i } as const;

  it('la frase interina de la guía es exactamente la del spec en español', () => {
    expect(leer('es').revision.guia.quitarSinCanal).toBe('Si te equivocas, elige el veredicto correcto; quitar la marca no se guarda.');
    expect(leer('en').revision.guia.quitarSinCanal).toBe('If you make a mistake, choose the right verdict; removing a mark is not saved.');
  });

  it.each(['es', 'en'] as const)('las claves de los retiros existen en %s, con singular y plural', (idioma) => {
    const { revision } = leer(idioma);
    expect(revision.guia.quitarSinCanal?.trim()).toBeTruthy();
    expect(revision['retirosEnEspera_one']).toContain('{{count}}');
    expect(revision['retirosEnEspera_other']).toContain('{{count}}');
    expect(revision['retirosEnEspera_one']).not.toBe(revision['retirosEnEspera_other']);
  });

  it.each(['es', 'en'] as const)('ningún texto de los retiros (%s) sugiere que se borren datos personales ni usa el guion largo', (idioma) => {
    const { revision } = leer(idioma);
    for (const texto of [revision.guia.quitarSinCanal!, revision['retirosEnEspera_one']!, revision['retirosEnEspera_other']!]) {
      expect(texto).not.toMatch(SUGIERE_BORRADO[idioma]);
      expect(texto).not.toContain('—');
    }
    if (idioma === 'es') for (const texto of [revision.guia.quitarSinCanal!, revision['retirosEnEspera_one']!]) expect(texto).not.toMatch(/\bvos\b|elegí|equivocás/i);
  });

  // #240: con la lectura del canal fallida, la barra no culpa al editor: dice que se reintenta sola.
  it.each(['es', 'en'] as const)('los textos de la lectura fallida (%s) existen y pasan las mismas reglas', (idioma) => {
    const { revision } = leer(idioma);
    const textos = [revision['retirosSinLectura_one']!, revision['retirosSinLectura_other']!];
    for (const texto of textos) {
      expect(texto).toContain('{{count}}');
      expect(texto).not.toMatch(SUGIERE_BORRADO[idioma]);
      expect(texto).not.toContain('—');
    }
    expect(textos[0]).not.toBe(textos[1]);
    if (idioma === 'es') {
      expect(textos[0]).not.toMatch(/\bvos\b|elegí|equivocás/i);
      expect(textos[0]).toBe('Quitaste {{count}} marca; no se pudo leer el canal y se volverá a intentar solo');
    }
  });
});
