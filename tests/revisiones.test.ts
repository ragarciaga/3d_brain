import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  agregarRevisores,
  aplicarPadron,
  argumentosImportar,
  errorDePadron,
  esRespuestaDelVago,
  importar,
  leerAutorizaciones,
  leerEnvios,
  parsearCsv,
  resumenConsolidado,
  resumenMarkdown,
  separarSinVago,
  ultimasRespuestas,
  type Envio,
} from '../scripts/lib/revisiones.ts';
import { CLAVES_V2, cargaRevisionV2, partesEnvio, urlFormulario, type Respuesta } from '../src/lib/revision';

const fila = (carga: object, nombre = 'Ana', recibido = '2026-10-11 10:00') => `${recibido},X,Y,"${JSON.stringify(carga).replace(/"/g, '""')}",${nombre}`;
/** Fila de la pestaña Respuestas del Apps Script: A recepción, B código, C ids, D carga. */
const filaHoja = (carga: { r: string; e: object }, recibido: string) =>
  `${recibido},${carga.r},"${Object.keys(carga.e).join(',')}","${JSON.stringify({ v: 2, ...carga }).replace(/"/g, '""')}"`;
const cabecera = 'Marca temporal,Código,Estructura,Revisión,Nombre';
const base = { idioma: 'es' as const, version: '0.1.0', fecha: '2026-10-11T10:00:00.000Z' };
/** Padrón de prueba: todos los códigos que usan estas pruebas, con su alias. */
const padron = { ANAT01: 'D01', PROF01: 'D02', P1: 'D03', X: 'D04' };
const estructuras = {
  hippocampus: { ficha: { version: '0.1.0' } },
  'm-periaqueductal-grey': { ficha: null },
};

const configForm = { urlFormulario: 'https://docs.google.com/forms/d/e/abc/viewform', campos: { codigo: 'entry.1', estructura: 'entry.2', revision: 'entry.3' } };
const fichaCriterio: Respuesta[] = [
  { ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' },
  { ...base, estructura: 'hippocampus', campo: 'que_es', veredicto: 'correcto' },
  { ...base, estructura: 'hippocampus', campo: 'para_que_sirve', veredicto: 'correcto' },
  { ...base, estructura: 'hippocampus', campo: 'relaciones', idioma: undefined, veredicto: 'corregir', propuesta: 'Agregar el subículo' },
];
const marcadorCriterio: Respuesta[] = [
  { estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [0.00123, 1.61234, -0.01987], version: 'sin-ficha', fecha: '2026-10-11T10:00:00.000Z' },
];

/** El escenario del criterio F24, tal como la app lo manda al formulario y queda en la hoja (envío v:1, uno por estructura). */
function csvDelCriterio(): string {
  const celda = (rs: Respuesta[], est: string) => new URL(urlFormulario(configForm, 'ANAT01', est, rs)!).searchParams.get('entry.3')!;
  return `${cabecera}\n${fila(JSON.parse(celda(fichaCriterio, 'hippocampus')))}\n${fila(JSON.parse(celda(marcadorCriterio, 'm-periaqueductal-grey')))}\n`;
}

/** El mismo escenario como lo manda la app hoy: todo en un solo envío v:2 (campo Revisión = entry.3). */
function csvDelCriterioV2(): string {
  const partes = partesEnvio(configForm, 'ANAT01', [...fichaCriterio, ...marcadorCriterio]);
  expect(partes).toHaveLength(1);
  return `${cabecera}\n${fila(JSON.parse(new URL(partes[0]!.url!).searchParams.get('entry.3')!))}\n`;
}

/** `revisor`: el código si el resumen sale directo de leerEnvios, el alias si sale de importar(). */
function verificarCinco(md: string, revisor = 'ANAT01'): void {
  expect(md).toContain('5 respuestas, 2 estructuras');
  const filas = md.split('\n').filter((l) => l.startsWith(`| \`${revisor}\` |`));
  expect(filas).toHaveLength(5);
  expect(md).toContain('posición 0.00123, 1.61234, -0.01987');
  expect(md).toContain('Agregar el subículo');
  for (const campo of ['ubicacion', 'que_es', 'para_que_sirve']) expect(filas.some((l) => l.includes(`| \`${campo}\` | es | correcto |`))).toBe(true);
}

describe('importar revisiones (F24)', () => {
  it('lee el CSV de Google con comillas y comas dentro de la celda JSON', () => {
    const carga = { v: 1, revisor: 'PROF01', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'corregir', propuesta: 'Texto, con coma' }] };
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n${fila(carga)}\n`));
    expect(invalidas).toBe(0);
    expect(envios[0]!.respuestas[0]!.propuesta).toBe('Texto, con coma');
  });

  it('el resumen usa el código del revisor, no su nombre, y marca versiones viejas', () => {
    const carga = { v: 1, revisor: 'PROF01', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' }] };
    const { envios } = leerEnvios(parsearCsv(`${cabecera}\n${fila(carga)}\n`));
    const md = resumenMarkdown('hippocampus', envios, '0.2.0');
    expect(md).toContain('PROF01');
    expect(md).not.toContain('Ana');
    expect(md).toContain('(desactualizada)');
  });

  it('descarta envíos con ids que no son estructuras conocidas (recorrido de rutas)', () => {
    const malo = { v: 1, revisor: 'X', estructura: '../../../AGENTS', respuestas: [{ ...base, estructura: '../../../AGENTS', campo: 'a', veredicto: 'correcto' }] };
    const desconocido = { v: 1, revisor: 'X', estructura: 'no-existe', respuestas: [{ ...base, estructura: 'no-existe', campo: 'a', veredicto: 'correcto' }] };
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n${fila(malo)}\n${fila(desconocido)}\n`), new Set(['hippocampus']));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(2);
  });

  it('criterio F24: tres correctos, una corrección y un marcador ubicado llegan como cinco respuestas a un solo resumen', () => {
    const { envios } = leerEnvios(parsearCsv(csvDelCriterio()), new Set(['hippocampus', 'm-periaqueductal-grey']));
    verificarCinco(resumenConsolidado(envios, () => '0.1.0'));
  });

  it('criterio F24 de punta a punta: importar() devuelve un resumen.md con las cinco y un archivo por estructura', () => {
    const { archivos, validos, invalidas } = importar(csvDelCriterio(), estructuras, padron);
    expect(validos).toBe(2);
    expect(invalidas).toBe(0);
    expect([...archivos.keys()].sort()).toEqual(['hippocampus.md', 'm-periaqueductal-grey.md', 'resumen.md']);
    verificarCinco(archivos.get('resumen.md')!, 'D01');
    expect(archivos.get('resumen.md')).not.toContain('ANAT01');
    expect(archivos.get('hippocampus.md')).toContain('Agregar el subículo');
    expect(archivos.get('hippocampus.md')).not.toContain('posición 0.00123');
    expect(archivos.get('m-periaqueductal-grey.md')).toContain('posición 0.00123, 1.61234, -0.01987');
  });

  it('importar() no genera archivo para un id desconocido ni para uno con forma de ruta', () => {
    const ok = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' }] };
    const desconocido = { v: 1, revisor: 'P1', estructura: 'no-existe', respuestas: [{ ...base, estructura: 'no-existe', campo: 'a', veredicto: 'correcto' }] };
    const ruta = { v: 1, revisor: 'P1', estructura: '../../../AGENTS', respuestas: [{ ...base, estructura: '../../../AGENTS', campo: 'a', veredicto: 'correcto' }] };
    const mezclada = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'no-existe', campo: 'a', veredicto: 'correcto' }] };
    const { archivos, validos, invalidas } = importar(`${cabecera}\n${fila(ok)}\n${fila(desconocido)}\n${fila(ruta)}\n${fila(mezclada)}\n`, estructuras, padron);
    expect([...archivos.keys()].sort()).toEqual(['hippocampus.md', 'resumen.md']);
    expect(validos).toBe(1);
    expect(invalidas).toBe(3);
    expect(archivos.get('resumen.md')).not.toContain('no-existe');
    expect(archivos.get('resumen.md')).toContain('1 respuestas, 1 estructuras');
  });
});

describe('leerEnvios sin lista de ids conocidos', () => {
  it('sigue rechazando ids con forma de ruta o con mayúsculas', () => {
    const envio = (estructura: string, estructuraRespuesta = estructura) => ({ v: 1, revisor: 'X', estructura, respuestas: [{ ...base, estructura: estructuraRespuesta, campo: 'a', veredicto: 'correcto' }] });
    const csv = [envio('../../../AGENTS'), envio('a/b'), envio('Hippocampus'), envio('hippocampus', '../x'), envio('hippocampus')].map((c) => fila(c)).join('\n');
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n${csv}\n`));
    expect(envios.map((e) => e.estructura)).toEqual(['hippocampus']);
    expect(invalidas).toBe(4);
  });
});

describe('resumenMarkdown con valores hostiles', () => {
  it('revisor, campo y versión con barra vertical o salto de línea no rompen la tabla del issue', () => {
    const env: Envio = {
      revisor: 'P|1\nX',
      estructura: 'hippocampus',
      marcaTemporal: '',
      respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ub|ic\nacion', veredicto: 'correcto', version: '9|9\n9' }],
    };
    const md = resumenMarkdown('hippocampus', [env], '0.1.0');
    const filas = md.split('\n').filter((l) => l.startsWith('| `P'));
    expect(filas).toHaveLength(1);
    expect(filas[0]!.split('|')).toHaveLength(9); // vacío + siete columnas + vacío
    expect(filas[0]).toContain('| `P/1 X` | `ub/ic acion` | es | correcto |');
    expect(filas[0]).toContain('`9/9 9` (desactualizada)');
  });
});

describe('leerEnvios rechaza respuestas mal formadas sin abortar la importación', () => {
  const buena = { ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' };
  const envio = (resp: unknown) => ({ v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [resp] });
  const leer = (...cargas: object[]) => leerEnvios(parsearCsv(`${cabecera}\n${cargas.map((c) => fila(c)).join('\n')}\n`), new Set(['hippocampus']));

  it.each([
    ['veredicto fuera del conjunto', { ...buena, veredicto: 'aprobado' }],
    ['veredicto ausente', { ...buena, veredicto: undefined }],
    ['idioma distinto de es y en', { ...buena, idioma: 'fr' }],
    ['idioma que no es texto', { ...buena, idioma: 5 }],
    ['campo que no es texto', { ...buena, campo: 7 }],
    ['campo ausente', { ...buena, campo: undefined }],
    ['propuesta que no es texto', { ...buena, propuesta: { a: 1 } }],
    ['comentario que no es texto', { ...buena, comentario: ['x'] }],
    ['version que no es texto', { ...buena, version: 1 }],
    ['malla que no es texto', { ...buena, malla: 3 }],
    ['ramo que no es texto', { ...buena, ramo: null }],
    ['posicion que no es un arreglo', { ...buena, posicion: '1,2,3' }],
    ['posicion con dos números', { ...buena, posicion: [1, 2] }],
    ['posicion con cuatro números', { ...buena, posicion: [1, 2, 3, 4] }],
    ['posicion con un texto', { ...buena, posicion: [1, '2', 3] }],
    ['posicion con un valor no finito', { ...buena, posicion: [1, 2, null] }],
    ['respuesta que no es un objeto', null],
    ['respuesta que es un texto', 'hola'],
  ])('cuenta como inválido un envío con %s', (_nombre, resp) => {
    const { envios, invalidas } = leer(envio(resp));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('acepta idioma ausente, es y en, y una posición de tres números finitos', () => {
    const { envios, invalidas } = leer(
      envio({ ...buena, idioma: undefined }),
      envio({ ...buena, idioma: 'en' }),
      envio({ ...buena, campo: 'posicion', posicion: [0, -1.5, 2], propuesta: 'x', comentario: 'y', malla: 'm', ramo: 'r' }),
    );
    expect(invalidas).toBe(0);
    expect(envios).toHaveLength(3);
  });

  it('rechaza una posición con un número que JSON lee como infinito (1e999)', () => {
    const crudo = JSON.stringify(envio({ ...buena, posicion: [0, 0, 0] })).replace('[0,0,0]', '[0,1e999,0]');
    expect(crudo).toContain('1e999');
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n2026-10-11 10:00,X,Y,"${crudo.replace(/"/g, '""')}",Ana\n`), new Set(['hippocampus']));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('un JSON roto en una celda no aborta: se cuenta y se sigue con las demás filas', () => {
    const roto = '2026-10-11 10:00,X,Y,"{""v"":1,""revisor"":",Ana';
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n${roto}\n${fila(envio(buena))}\n`), new Set(['hippocampus']));
    expect(envios).toHaveLength(1);
    expect(invalidas).toBe(1);
  });

  it('una fila mala no aborta: las demás se importan y la mala se cuenta', () => {
    const { envios, invalidas } = leer(envio({ ...buena, veredicto: 'x' }), envio(buena), envio(null), { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: 'no' });
    expect(envios).toHaveLength(1);
    expect(invalidas).toBe(3);
  });

  it('importar() sigue produciendo resumen con una fila mala en medio', () => {
    const csv = `${cabecera}\n${fila(envio({ ...buena, posicion: [1, 2] }))}\n${fila(envio(buena))}\n`;
    const { validos, invalidas, archivos } = importar(csv, estructuras, padron);
    expect(validos).toBe(1);
    expect(invalidas).toBe(1);
    expect(archivos.get('resumen.md')).toContain('1 respuestas, 1 estructuras');
  });
});

describe('resumenMarkdown con texto libre hostil', () => {
  const env = (r: Partial<Respuesta>, marcaTemporal = '2026-10-11 10:00'): Envio => ({
    revisor: 'P1',
    estructura: 'hippocampus',
    marcaTemporal,
    respuestas: [{ ...base, estructura: 'hippocampus', campo: 'que_es', veredicto: 'corregir', ...r }],
  });
  const fila1 = (md: string) => md.split('\n').find((l) => l.startsWith('| `P1` |'))!;

  it('la propuesta y el comentario salen como código en línea y no rompen la tabla', () => {
    const md = resumenMarkdown('hippocampus', [env({ propuesta: 'a | b\n| c |', comentario: 'x | y\n# titulo **negrita**' })], '0.1.0');
    const f = fila1(md);
    expect(f.split('|')).toHaveLength(9);
    expect(f).toContain('`a / b / c /`');
    expect(f).toContain('Comentario: `x / y # titulo **negrita**`');
  });

  it('una comilla invertida en el texto no cierra el código en línea', () => {
    const f = fila1(resumenMarkdown('hippocampus', [env({ propuesta: 'ab`c`d' })], '0.1.0'));
    expect(f).toContain("`ab'c'd`");
  });

  it('neutraliza las menciones con @ en propuesta, comentario, revisor y ramo', () => {
    const e = env({ propuesta: 'cc @editor y @org/equipo', comentario: 'hola @usuario', ramo: '@otro', malla: '@malla' });
    e.revisor = '@revisor';
    const md = resumenMarkdown('hippocampus', [e], '0.1.0');
    expect(md).not.toMatch(/@[A-Za-z]/);
    expect(md).toContain('@\u200Beditor');
    expect(md).toContain('@\u200Busuario');
  });

  it('agrega una columna con la marca temporal del envío', () => {
    const md = resumenMarkdown('hippocampus', [env({}, '2026-10-11 10:00')], '0.1.0');
    expect(md).toContain('| Versión revisada | Enviado |');
    expect(fila1(md)).toMatch(/\| `2026-10-11 10:00` \|$/);
  });

  it('la marca temporal es la del envío más reciente de cada respuesta', () => {
    const md = resumenMarkdown('hippocampus', [env({ veredicto: 'corregir' }, 'T1'), env({ veredicto: 'correcto' }, 'T2')], '0.1.0');
    const filas = md.split('\n').filter((l) => l.startsWith('| `P1` |'));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatch(/\| `T2` \|$/);
    expect(filas[0]).toContain('| correcto |');
  });
});

describe('texto del formulario público: validación y salida como código en línea', () => {
  const buena = { ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' };
  const envio = (resp: unknown, revisor = 'PROF01') => ({ v: 1, revisor, estructura: 'hippocampus', respuestas: [resp] });
  const leer = (...cargas: object[]) => leerEnvios(parsearCsv(`${cabecera}\n${cargas.map((c) => fila(c)).join('\n')}\n`), new Set(['hippocampus']));
  const sinCodigo = (md: string) => md.replace(/`[^`]*`/g, '');

  const hostiles = ['[x](https://e.example)', '<a href="https://e.example">x</a>', '#123', 'owner/repo#123', 'a b'];

  it.each(hostiles)('rechaza %s en campo', (valor) => {
    const { envios, invalidas } = leer(envio({ ...buena, campo: valor }));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it.each(hostiles)('rechaza %s en version', (valor) => {
    const { envios, invalidas } = leer(envio({ ...buena, version: valor }));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it.each([...hostiles, '', 'x'.repeat(41), 'ANA.PEREZ', 'ñandú'])('rechaza %j como revisor', (valor) => {
    const { envios, invalidas } = leer(envio(buena, valor));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('un revisor que no es texto es inválido', () => {
    expect(leer(envio(buena, 5 as unknown as string)).invalidas).toBe(1);
    expect(leer({ v: 1, estructura: 'hippocampus', respuestas: [buena] }).invalidas).toBe(1);
  });

  it('acepta los campos que genera la app, las versiones y los códigos con guion', () => {
    const campos = ['nombre', 'latin', 'pieza', 'ubicacion', 'que_es', 'para_que_sirve', 'relaciones', 'relevancia.0', 'fuente.12', 'posicion', 'trazo:Vagus_nerve.R (rama) 01'];
    const cargas = [
      ...campos.map((campo) => envio({ ...buena, campo })),
      envio({ ...buena, version: 'sin-ficha' }),
      envio(buena, 'K7Q2M9XA'),
      envio(buena, 'doc_01-b'),
      envio(buena, 'x'.repeat(40)),
    ];
    const { envios, invalidas } = leer(...cargas);
    expect(invalidas).toBe(0);
    expect(envios).toHaveLength(cargas.length);
  });

  it('el código del revisor largo no se trunca: o es válido entero o se descarta', () => {
    const { envios } = leer(envio(buena, 'x'.repeat(40)));
    expect(envios[0]!.revisor).toBe('x'.repeat(40));
  });

  it.each([
    ['campo trazo con comilla invertida', { campo: 'trazo:a`b' }],
    ['campo trazo con barra vertical', { campo: 'trazo:a|b' }],
    ['campo trazo con ángulos', { campo: 'trazo:<img>' }],
    ['campo trazo con salto de línea', { campo: 'trazo:a\nb' }],
    ['campo trazo vacío', { campo: 'trazo:' }],
    ['campo trazo con 121 caracteres tras el prefijo', { campo: `trazo:${'a'.repeat(121)}` }],
    ['campo en mayúsculas', { campo: 'Nombre' }],
    ['campo con índice sin número', { campo: 'fuente.x' }],
    ['version incompleta', { version: '0.1' }],
    ['version con sufijo', { version: '0.1.0-x' }],
    ['propuesta de 4001 caracteres', { propuesta: 'a'.repeat(4001) }],
    ['comentario de 4001 caracteres', { comentario: 'a'.repeat(4001) }],
    ['malla de 201 caracteres', { malla: 'a'.repeat(201) }],
    ['ramo de 201 caracteres', { ramo: 'a'.repeat(201) }],
  ])('rechaza %s', (_nombre, extra) => {
    const { envios, invalidas } = leer(envio({ ...buena, ...extra }));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('acepta textos justo en el tope', () => {
    const { invalidas } = leer(envio({ ...buena, propuesta: 'a'.repeat(4000), comentario: 'b'.repeat(4000), malla: 'c'.repeat(200), ramo: 'd'.repeat(200), campo: `trazo:${'e'.repeat(120)}` }));
    expect(invalidas).toBe(0);
  });

  it('propuesta, comentario, ramo, malla y marca temporal hostiles salen solo dentro de comillas invertidas', () => {
    const hostil = '[x](https://e.example) <img src=x> #123 owner/repo#123';
    const csv = `${cabecera}\n${fila(envio({ ...buena, campo: 'relaciones', propuesta: hostil, comentario: hostil }))}\n${fila(envio({ ...buena, campo: 'fuente.0', ramo: hostil, malla: hostil, propuesta: undefined }))}\n`.replace('2026-10-11 10:00', '[t](https://e.example) <b>t</b> #123');
    const { archivos, validos, invalidas } = importar(csv, estructuras, padron);
    expect(invalidas).toBe(0);
    expect(validos).toBe(2);
    for (const md of [archivos.get('hippocampus.md')!, archivos.get('resumen.md')!]) {
      expect(md).toContain('`[x](https://e.example) <img src=x> #123 owner/repo#123`');
      expect(md).toContain('`[t](https://e.example) <b>t</b> #123`');
      const fuera = sinCodigo(md);
      expect(fuera).not.toContain('](');
      expect(fuera).not.toContain('<img');
      expect(fuera).not.toContain('<b>');
      expect(fuera).not.toMatch(/#\d/);
      expect(fuera).not.toContain('example');
    }
  });

  it('revisor, campo y versión salen como código y "(desactualizada)" queda fuera del código', () => {
    const { envios } = leer(envio({ ...buena, version: '0.0.9' }, 'K7Q2M9XA'));
    const f = resumenMarkdown('hippocampus', envios, '0.1.0').split('\n').find((l) => l.includes('K7Q2M9XA'))!;
    expect(f).toContain('| `K7Q2M9XA` | `ubicacion` | es | correcto |');
    expect(f).toContain('| `0.0.9` (desactualizada) |');
  });
});

describe('revisión por ruta trazada (spec 02 R5)', () => {
  const NOTA = '(desactualizada) campo por lado, no se aplica a ninguna ruta';
  const estructurasVago = { ...estructuras, 'vagus-nerve-x': { ficha: { version: '0.1.0' } } };
  const resp = (campo: string, extra: Partial<Respuesta> = {}): Respuesta => ({
    estructura: 'vagus-nerve-x',
    campo,
    veredicto: 'correcto',
    version: '0.1.0',
    fecha: '2026-10-11T10:00:00.000Z',
    ...extra,
  });
  const envio = (revisor: string, ...respuestas: Respuesta[]): Envio => ({ revisor, estructura: 'vagus-nerve-x', marcaTemporal: '2026-10-11 10:00', respuestas });
  const filas = (md: string) => md.split('\n').filter((l) => l.startsWith('| `P1` |'));

  it('R5.2: un campo por ruta con la versión vigente sale sin "desactualizada" y con su campo en la fila', () => {
    const md = resumenMarkdown('vagus-nerve-x', [envio('P1', resp('trazado_vago_toracico_derecho'))], '0.1.0');
    const f = filas(md);
    expect(f).toHaveLength(1);
    expect(f[0]).toContain('| `trazado_vago_toracico_derecho` |');
    expect(f[0]).toContain('| `0.1.0` |');
    expect(f[0]).not.toContain('desactualizada');
  });

  it('R5.2: las respuestas a dos rutas del mismo revisor salen en dos filas, cada una con su veredicto', () => {
    const e = envio('P1', resp('trazado_vago_toracico_derecho', { veredicto: 'correcto' }), resp('trazado_vago_toracico_izquierdo', { veredicto: 'corregir', propuesta: 'Más medial' }));
    const f = filas(resumenMarkdown('vagus-nerve-x', [e], '0.1.0'));
    expect(f).toHaveLength(2);
    const derecha = f.find((l) => l.includes('`trazado_vago_toracico_derecho`'))!;
    const izquierda = f.find((l) => l.includes('`trazado_vago_toracico_izquierdo`'))!;
    expect(derecha).toContain('| correcto |');
    expect(derecha).not.toContain('corregir');
    expect(izquierda).toContain('| corregir |');
    expect(izquierda).toContain('`Más medial`');
  });

  it.each(['trazado_derecho', 'trazado_izquierdo'])('R5.3: %s con la versión vigente sale desactualizada y sin aplicarse a ninguna ruta', (campo) => {
    const f = filas(resumenMarkdown('vagus-nerve-x', [envio('P1', resp(campo))], '0.1.0'));
    expect(f).toHaveLength(1);
    expect(f[0]).toContain(`| \`${campo}\` |`);
    expect(f[0]).toContain(`\`0.1.0\` ${NOTA} |`);
  });

  it('R5.3: un campo por lado con una versión vieja lleva un solo "(desactualizada)" y la nota', () => {
    const f = filas(resumenMarkdown('vagus-nerve-x', [envio('P1', resp('trazado_derecho', { version: '0.0.9' }))], '0.1.0'));
    expect(f).toHaveLength(1);
    expect(f[0]).toContain(`\`0.0.9\` ${NOTA} |`);
    expect(f[0]!.match(/desactualizada/g)).toHaveLength(1);
  });

  it.each(['trazado_vago_izquierdo_distal', 'trazado_laringeo_recurrente_derecho'])('control: %s lleva la palabra del lado pero es un campo por ruta y no se marca', (campo) => {
    const f = filas(resumenMarkdown('vagus-nerve-x', [envio('P1', resp(campo))], '0.1.0'));
    expect(f).toHaveLength(1);
    expect(f[0]).not.toContain('desactualizada');
    expect(f[0]).not.toContain('campo por lado');
  });

  it('un campo por ruta con una versión vieja sigue marcándose como cualquier otro campo', () => {
    const f = filas(resumenMarkdown('vagus-nerve-x', [envio('P1', resp('trazado_vago_toracico_derecho', { version: '0.0.9' }))], '0.1.0'));
    expect(f[0]).toContain('`0.0.9` (desactualizada) |');
    expect(f[0]).not.toContain('campo por lado');
  });

  it('importar() de punta a punta: la nota solo sale en las filas por lado y la tabla no se rompe', () => {
    const carga = {
      v: 2,
      r: 'P1',
      e: {
        'vagus-nerve-x': [
          { c: 'trazado_vago_toracico_derecho', d: 'correcto', s: '0.1.0' },
          { c: 'trazado_derecho', d: 'correcto', s: '0.1.0' },
          { c: 'trazado_izquierdo', d: 'corregir', s: '0.1.0', p: 'x' },
        ],
      },
    };
    const autorizacion = 'Código,Fecha,Versión,Vago\nP1,2026-10-15T10:00:00.000Z,1,sí\n';
    const { archivos, validos, invalidas } = importar(`${cabecera}\n${fila(carga)}\n`, estructurasVago, padron, autorizacion);
    expect(invalidas).toBe(0);
    expect(validos).toBe(1);
    const md = archivos.get('vagus-nerve-x.md')!;
    const f = md.split('\n').filter((l) => l.startsWith('| `D03` |'));
    expect(f).toHaveLength(3);
    for (const l of f) expect(l.split('|')).toHaveLength(9);
    const porRuta = f.find((l) => l.includes('`trazado_vago_toracico_derecho`'))!;
    expect(porRuta).not.toContain('desactualizada');
    for (const campo of ['trazado_derecho', 'trazado_izquierdo']) {
      expect(f.find((l) => l.includes(`\`${campo}\``))).toContain(`\`0.1.0\` ${NOTA} |`);
    }
  });
});

describe('reenvíos', () => {
  const r = (idioma: 'es' | 'en', veredicto: 'correcto' | 'corregir'): Respuesta => ({ ...base, estructura: 'hippocampus', campo: 'ubicacion', idioma, veredicto });
  const env = (revisor: string, respuestas: Respuesta[]): Envio => ({ revisor, estructura: 'hippocampus', marcaTemporal: '', respuestas });

  it('queda solo la respuesta más reciente por revisor, campo e idioma', () => {
    const u = ultimasRespuestas([env('P1', [r('es', 'corregir')]), env('P1', [r('es', 'correcto')])]);
    expect(u).toHaveLength(1);
    expect(u[0]!.r.veredicto).toBe('correcto');
  });

  it('el mismo campo en español y en inglés son dos respuestas distintas', () => {
    expect(ultimasRespuestas([env('P1', [r('es', 'correcto'), r('en', 'corregir')])])).toHaveLength(2);
  });

  it('dos revisores sobre el mismo campo son dos respuestas distintas', () => {
    expect(ultimasRespuestas([env('P1', [r('es', 'correcto')]), env('P2', [r('es', 'corregir')])])).toHaveLength(2);
  });
});

describe('padrón privado de revisores (#15)', () => {
  const ok = { v: 1, revisor: 'PROF01', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' }] };
  const intruso = { ...ok, revisor: 'ZZZZ9999' };

  it('el resumen muestra el alias, nunca el código, y descarta los códigos fuera del padrón', () => {
    const { archivos, validos, desconocidos } = importar(`${cabecera}\n${fila(ok)}\n${fila(intruso)}\n`, estructuras, padron);
    expect(validos).toBe(1);
    expect(desconocidos).toBe(1);
    for (const md of archivos.values()) {
      expect(md).not.toContain('PROF01');
      expect(md).not.toContain('ZZZZ9999');
    }
    expect(archivos.get('hippocampus.md')).toContain('`D02`');
    expect(archivos.get('resumen.md')).toContain('Se descartaron 1 envíos con un código que no está en el padrón');
  });

  it('un código que coincide con una propiedad de Object no cuenta como conocido', () => {
    const { envios, desconocidos } = aplicarPadron([{ revisor: 'constructor', estructura: 'hippocampus', respuestas: [], marcaTemporal: '' }], padron);
    expect(envios).toEqual([]);
    expect(desconocidos).toBe(1);
  });

  it('valida el padrón: objeto, códigos válidos y alias D01, D02... sin repetir', () => {
    expect(errorDePadron(padron)).toBeNull();
    expect(errorDePadron([])).toMatch(/objeto/);
    expect(errorDePadron({ 'mal código': 'D01' })).toMatch(/código inválido/);
    expect(errorDePadron({ AAAA1111: 'Ana' })).toMatch(/alias inválido/);
    expect(errorDePadron({ AAAA1111: 'D01', BBBB2222: 'D01' })).toMatch(/repetido/);
  });

  it('agregarRevisores crea códigos de 8 caracteres sin repetir y alias consecutivos', () => {
    let i = 0;
    const azar = (max: number) => (i++ * 7) % max;
    const { padron: nuevo, nuevos } = agregarRevisores({ EXISTENT: 'D02' }, 10, azar);
    expect(nuevos.map((x) => x[1])).toEqual(['D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12']);
    expect(Object.keys(nuevo)).toHaveLength(11);
    for (const [codigo] of nuevos) expect(codigo).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(errorDePadron(nuevo)).toBeNull();
  });
});

describe('carga v:2 (#58)', () => {
  const ids = new Set(['hippocampus', 'm-periaqueductal-grey']);
  const buena = { c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0' };
  const v2 = (e: unknown, r: unknown = 'P1') => ({ v: 2, r, e });
  const leer = (...cargas: object[]) => leerEnvios(parsearCsv(`${cabecera}\n${cargas.map((c) => fila(c)).join('\n')}\n`), ids);

  it('v:1 y v:2 con las mismas respuestas dan el mismo resumen (D5)', () => {
    const v1 = importar(csvDelCriterio(), estructuras, padron);
    const v2r = importar(csvDelCriterioV2(), estructuras, padron);
    expect([...v1.archivos]).toEqual([...v2r.archivos]);
    expect(v2r.validos).toBe(2);
    expect(v1.validos).toBe(2);
    expect(v1.invalidas).toBe(0);
    expect(v2r.invalidas).toBe(0);
    verificarCinco(v2r.archivos.get('resumen.md')!, 'D01');
  });

  it('v:1 y v:2 mezclados: queda la más reciente (D5)', () => {
    const v1 = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'corregir', propuesta: 'x' }] };
    const nueva = v2({ hippocampus: [{ ...buena, d: 'correcto' }] });
    const { archivos } = importar(`${cabecera}\n${fila(v1)}\n${fila(nueva)}\n`, estructuras, padron);
    const filas = archivos.get('resumen.md')!.split('\n').filter((l) => l.startsWith('| `D03` |'));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toContain('| `ubicacion` | es | correcto |');
  });

  it('ida y vuelta de todos los campos (D6)', () => {
    const entrada: Respuesta[] = [
      { estructura: 'hippocampus', campo: 'relaciones', veredicto: 'corregir', propuesta: 'p', comentario: 'k', version: '0.1.0', fecha: '2026-10-14T08:00:00.000Z' },
      { estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [1, 2.5, -3], malla: 'Vagus_nerve.R', ramo: 'no_se', version: 'sin-ficha', fecha: '2026-10-14T08:01:00.000Z' },
      { estructura: 'm-periaqueductal-grey', campo: 'trazo:Vagus_nerve.R (rama) 01', idioma: 'en', veredicto: 'no_es_mi_area', version: 'sin-ficha', fecha: '2026-10-14T08:02:00.000Z' },
    ];
    const partes = partesEnvio(configForm, 'P1', entrada);
    const { envios, invalidas } = leer(JSON.parse(new URL(partes[0]!.url!).searchParams.get('entry.3')!));
    expect(invalidas).toBe(0);
    expect(envios.map((e) => e.estructura)).toEqual(['hippocampus', 'm-periaqueductal-grey']);
    expect(envios.every((e) => e.revisor === 'P1' && e.marcaTemporal === '2026-10-11 10:00')).toBe(true);
    expect(envios.flatMap((e) => e.respuestas)).toEqual(entrada);
  });

  it('descarta las claves desconocidas de cada elemento y no deja que traigan estructura ni fecha con su nombre largo', () => {
    const { envios } = leer(v2({ hippocampus: [{ ...buena, estructura: 'm-periaqueductal-grey', fecha: 'hoy', zzz: 1 }] }));
    expect(envios[0]!.respuestas[0]).toEqual({ estructura: 'hippocampus', fecha: '', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0' });
  });

  it('CLAVES_V2 cubre todos los campos que valida el importador y la fecha', () => {
    expect(Object.keys(CLAVES_V2).sort()).toEqual(['campo', 'comentario', 'fecha', 'idioma', 'malla', 'posicion', 'propuesta', 'ramo', 'veredicto', 'version']);
  });

  it('v:2 con f devuelve la fecha original en cada respuesta', () => {
    const { envios, invalidas } = leer(v2({ hippocampus: [{ ...buena, f: '2026-10-14T10:00:00.000Z' }, { ...buena, c: 'que_es', f: '2026-10-14T10:00:01.000Z' }] }));
    expect(invalidas).toBe(0);
    expect(envios[0]!.respuestas.map((x) => x.fecha)).toEqual(['2026-10-14T10:00:00.000Z', '2026-10-14T10:00:01.000Z']);
  });

  it('v:2 sin f queda con fecha vacía', () => {
    const sola = leer(v2({ hippocampus: [buena] }));
    expect(sola.invalidas).toBe(0);
    expect(sola.envios[0]!.respuestas[0]!.fecha).toBe('');

    const carga = cargaRevisionV2('P1', [{ estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '' }]);
    expect(carga).not.toContain('"f"');
    const emitida = leer(JSON.parse(carga));
    expect(emitida.invalidas).toBe(0);
    expect(emitida.envios[0]!.respuestas[0]!.fecha).toBe('');

    const mixta = leer(v2({ hippocampus: [{ ...buena, f: '2026-10-14T10:00:00.000Z' }, { ...buena, c: 'que_es' }] }));
    expect(mixta.invalidas).toBe(0);
    expect(mixta.envios[0]!.respuestas.map((x) => x.fecha)).toEqual(['2026-10-14T10:00:00.000Z', '']);
  });

  it('acepta una f parseable de exactamente 40 caracteres', () => {
    const f40 = `2026-10-10T10:00:00.${'0'.repeat(19)}Z`;
    expect(f40).toHaveLength(40);
    const { envios, invalidas } = leer(v2({ hippocampus: [{ ...buena, f: f40 }] }));
    expect(invalidas).toBe(0);
    expect(envios[0]!.respuestas[0]!.fecha).toBe(f40);
  });

  it.each([
    ['e es un arreglo', v2([buena])],
    ['e está vacío', v2({})],
    ['e es un texto', v2('hippocampus')],
    ['e ausente', { v: 2, r: 'P1' }],
    ['clave con forma de ruta', v2({ '../../../AGENTS': [buena] })],
    ['clave de estructura desconocida', v2({ 'no-existe': [buena] })],
    ['una clave buena y otra de ruta', v2({ hippocampus: [buena], '../x': [buena] })],
    ['valor que no es arreglo', v2({ hippocampus: buena })],
    ['arreglo vacío', v2({ hippocampus: [] })],
    ['elemento null', v2({ hippocampus: [buena, null] })],
    ['elemento que es un texto', v2({ hippocampus: ['hola'] })],
    ['veredicto fuera del conjunto', v2({ hippocampus: [{ ...buena, d: 'aprobado' }] })],
    ['campo con almohadilla', v2({ hippocampus: [{ ...buena, c: '#123' }] })],
    ['versión que no es semántica', v2({ hippocampus: [{ ...buena, s: '0.1' }] })],
    ['versión ausente', v2({ hippocampus: [{ c: 'a', d: 'correcto' }] })],
    ['propuesta de 4001 caracteres', v2({ hippocampus: [{ ...buena, p: 'x'.repeat(4001) }] })],
    ['comentario de 4001 caracteres', v2({ hippocampus: [{ ...buena, k: 'x'.repeat(4001) }] })],
    ['posición con dos números', v2({ hippocampus: [{ ...buena, x: [1, 2] }] })],
    ['idioma fr', v2({ hippocampus: [{ ...buena, i: 'fr' }] })],
    ['malla que no es texto', v2({ hippocampus: [{ ...buena, m: 3 }] })],
    ['ramo de 201 caracteres', v2({ hippocampus: [{ ...buena, a: 'x'.repeat(201) }] })],
    ['f de 41 caracteres', v2({ hippocampus: [{ ...buena, f: `2026-10-10T10:00:00.${'0'.repeat(20)}Z` }] })],
    ['f que no es texto', v2({ hippocampus: [{ ...buena, f: 1760000000000 }] })],
    ['f no parseable', v2({ hippocampus: [{ ...buena, f: 'ayer' }] })],
    ['f vacía', v2({ hippocampus: [{ ...buena, f: '' }] })],
    ['una respuesta mala entre buenas', v2({ hippocampus: [buena, { ...buena, c: 'otro' }], 'm-periaqueductal-grey': [{ ...buena, d: 'x' }] })],
    ['revisor ausente', { v: 2, e: { hippocampus: [buena] } }],
    ['revisor con punto', v2({ hippocampus: [buena] }, 'ANA.PEREZ')],
    ['revisor que no es texto', v2({ hippocampus: [buena] }, 7)],
    ['v distinto de 1 y 2 con forma v:1', { v: 3, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'a', veredicto: 'correcto' }] }],
    ['v distinto de 1 y 2 con forma v:2', { ...v2({ hippocampus: [buena] }), v: 3 }],
    ['v texto "2"', { ...v2({ hippocampus: [buena] }), v: '2' }],
  ])('cuenta como inválida una fila con %s', (_nombre, carga) => {
    const { envios, invalidas } = leer(carga);
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('sin lista de ids conocidos, e como arreglo se rechaza aunque su índice "0" tenga forma de slug', () => {
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n${fila(v2([[buena]]))}\n`));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('una clave __proto__ en e (JSON crudo) se rechaza', () => {
    const crudo = '{"v":2,"r":"P1","e":{"__proto__":[{"c":"a","d":"correcto","s":"0.1.0"}]}}';
    expect(Object.keys(JSON.parse(crudo).e)).toEqual(['__proto__']);
    const { envios, invalidas } = leerEnvios(parsearCsv(`${cabecera}\n2026-10-11 10:00,X,Y,"${crudo.replace(/"/g, '""')}",Ana\n`));
    expect(envios).toEqual([]);
    expect(invalidas).toBe(1);
  });

  it('una fila v:2 mala no aborta: una v:1 buena se importa y la mala se cuenta (D5)', () => {
    const malo = v2({ hippocampus: [{ ...buena, d: 'aprobado' }] });
    const bueno = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' }] };
    const { validos, invalidas, archivos } = importar(`${cabecera}\n${fila(malo)}\n${fila(bueno)}\n`, estructuras, padron);
    expect(validos).toBe(1);
    expect(invalidas).toBe(1);
    expect(archivos.get('resumen.md')).toContain('1 respuestas, 1 estructuras');
  });

  it('una fila v:2 buena con dos estructuras cuenta un envío por estructura', () => {
    const { validos, invalidas } = importar(`${cabecera}\n${fila(v2({ hippocampus: [buena], 'm-periaqueductal-grey': [{ ...buena, s: 'sin-ficha' }] }))}\n`, estructuras, padron);
    expect(validos).toBe(2);
    expect(invalidas).toBe(0);
  });
});

describe('pestaña Respuestas del Apps Script (spec 03)', () => {
  const cabeceraHoja = 'Recibido,Código,Estructuras,Carga';
  const el = (extra: object) => ({ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0', f: '2026-10-14T10:00:00.000Z', ...extra });
  const filasDe = (md: string, alias: string) => md.split('\n').filter((l) => l.startsWith(`| \`${alias}\` |`));

  it('da los mismos archivos que el CSV del formulario (R8.1)', () => {
    const hojaCsv = readFileSync('tests/fixtures/revisiones/hoja-respuestas.csv', 'utf8');
    const datos = parsearCsv(hojaCsv).slice(1);
    expect(datos).toHaveLength(3);
    for (const f of datos) expect(f).toHaveLength(4);

    const formCsv = `${cabecera}\n${datos.map(([a, , , d]) => fila(JSON.parse(d!), 'Ana', a)).join('\n')}\n`;
    const hoja = importar(hojaCsv, estructuras, padron);
    const form = importar(formCsv, estructuras, padron);
    expect([...hoja.archivos]).toEqual([...form.archivos]);
    expect(hoja.validos).toBe(form.validos);
    expect(hoja.invalidas).toBe(form.invalidas);
    expect(hoja.desconocidos).toBe(form.desconocidos);

    expect(hoja.validos).toBe(5);
    expect(hoja.invalidas).toBe(0);
    expect([...hoja.archivos.keys()].sort()).toEqual(['hippocampus.md', 'm-periaqueductal-grey.md', 'resumen.md']);
    const resumen = hoja.archivos.get('resumen.md')!;
    expect(resumen).toContain('4 respuestas, 2 estructuras');
    expect(resumen).toContain('`D01`');
    expect(resumen).toContain('`D02`');
    expect(resumen).not.toContain('ANAT01');
    expect(resumen).not.toContain('PROF01');
    const d01 = filasDe(resumen, 'D01');
    expect(d01).toHaveLength(3);
    for (const l of d01) expect(l).toMatch(/`2026-10-14 09:00:09` \|$/);
  });

  it('misma clave y misma fecha cuentan una sola respuesta (R3.6)', () => {
    const carga = { r: 'ANAT01', e: { hippocampus: [el({})] } };
    const csv = `${cabeceraHoja}\n${filaHoja(carga, '2026-10-14 10:00:05')}\n${filaHoja(carga, '2026-10-14 10:00:09')}\n`;
    const { archivos } = importar(csv, estructuras, padron);
    const resumen = archivos.get('resumen.md')!;
    expect(resumen).toContain('1 respuestas, 1 estructuras');
    expect(filasDe(resumen, 'D01')).toHaveLength(1);
  });

  it('con fechas distintas queda la última fila (R3.6)', () => {
    const primera = { r: 'ANAT01', e: { hippocampus: [el({ d: 'corregir', p: 'x', f: '2026-10-14T10:00:00.000Z' })] } };
    const segunda = { r: 'ANAT01', e: { hippocampus: [el({ d: 'correcto', f: '2026-10-14T10:05:00.000Z' })] } };
    const csv = `${cabeceraHoja}\n${filaHoja(primera, '2026-10-14 10:00:05')}\n${filaHoja(segunda, '2026-10-14 10:05:05')}\n`;
    const { archivos } = importar(csv, estructuras, padron);
    const filas = filasDe(archivos.get('resumen.md')!, 'D01');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toContain('| correcto |');
    expect(filas[0]).not.toContain('corregir');
    expect(filas[0]).toMatch(/`2026-10-14 10:05:05` \|$/);
  });

  describe('filas de otras pestañas (R8.2)', () => {
    const resp1 = filaHoja({ r: 'ANAT01', e: { hippocampus: [el({})] } }, '2026-10-14 10:00:05');
    const resp2 = filaHoja({ r: 'PROF01', e: { hippocampus: [el({ c: 'que_es' })] } }, '2026-10-14 10:02:05');
    const soloRespuestas = `${cabeceraHoja}\n${resp1}\n${resp2}\n`;
    const mezclado = [
      cabeceraHoja,
      resp1,
      'ZZZZ9999,2026-10-14T10:00:00.000Z,aut-v1,sí',
      'ANAT01,2026-10-14T10:01:00.000Z,aut-v1,no',
      resp2,
      'ANAT01,D01,sí',
      'ZZZZ9999,D100,no',
    ].join('\n') + '\n';

    it('las filas de Autorizaciones y Padrón no cuentan ni salen', () => {
      const ids = new Set(['hippocampus']);
      const limpio = leerEnvios(parsearCsv(soloRespuestas), ids);
      const sucio = leerEnvios(parsearCsv(mezclado), ids);
      expect(limpio.envios).toHaveLength(2);
      expect(sucio.envios).toEqual(limpio.envios);
      expect(sucio.invalidas).toBe(0);

      const a = importar(mezclado, estructuras, padron);
      const b = importar(soloRespuestas, estructuras, padron);
      expect([...a.archivos]).toEqual([...b.archivos]);
      expect(a.desconocidos).toBe(0);
      expect(a.invalidas).toBe(0);
      expect(a.validos).toBe(2);
      for (const md of a.archivos.values()) {
        for (const x of ['ZZZZ9999', 'aut-v1', 'D100']) expect(md).not.toContain(x);
      }
    });

    it.each([
      ['Autorizaciones con A con punto', 'ANA.PEREZ,2026-10-14T10:00:00.000Z,aut-v1,sí'],
      ['Autorizaciones con B ilegible', 'ANAT01,ayer,aut-v1,sí'],
      ['Autorizaciones con C vacía', 'ANAT01,2026-10-14T10:00:00.000Z,,sí'],
      ['Autorizaciones con D distinto de sí y no', 'ANAT01,2026-10-14T10:00:00.000Z,aut-v1,quizá'],
      ['Autorizaciones con cinco columnas', 'ANAT01,2026-10-14T10:00:00.000Z,aut-v1,sí,extra'],
      ['Padrón con A con punto', 'ANA.PEREZ,D01,sí'],
      ['Padrón con B que no es alias', 'ANAT01,Ana,sí'],
      ['Padrón con C distinto de sí y no', 'ANAT01,D01,quizá'],
      ['fila sin carga y sin forma', 'texto suelto'],
    ])('una fila casi con forma de otra pestaña sigue siendo inválida: %s', (_n, filaBasura) => {
      const { envios, invalidas } = leerEnvios(parsearCsv(`${cabeceraHoja}\n${filaBasura}\n`), new Set(['hippocampus']));
      expect(envios).toEqual([]);
      expect(invalidas).toBe(1);
    });
  });
});

describe('casilla del vago (S2, #163)', () => {
  const estructurasVago = {
    hippocampus: { ficha: { version: '0.1.0' } },
    'm-recurrent-laryngeal-nerve': { ficha: null },
    'vagus-nerve-x': { ficha: { version: '0.1.0' } },
  };
  const padronVago: Record<string, string> = JSON.parse(readFileSync('tests/fixtures/revisiones/padron-prueba.json', 'utf8'));
  const hojaVago = readFileSync('tests/fixtures/revisiones/hoja-respuestas-vago.csv', 'utf8');
  const autorizaciones = readFileSync('tests/fixtures/revisiones/hoja-autorizaciones.csv', 'utf8');
  const TITULO_SECCION = '## Descartadas: sin la casilla del vago';
  const FRASE_SIN_ARCHIVO = 'No se pasó el CSV de Autorizaciones (--autorizaciones): ninguna respuesta del vago entra al resumen.';
  const cabeceraAut = 'Código,Fecha,Versión,Vago';
  const filasDe = (md: string, alias: string) => md.split('\n').filter((l) => l.startsWith(`| \`${alias}\` |`));
  /** Lo que queda antes de la sección de descartadas (o todo el texto si no hay sección). */
  const normal = (md: string) => (md.includes(TITULO_SECCION) ? md.slice(0, md.indexOf(TITULO_SECCION)) : md);
  const descartadas = (md: string) => (md.includes(TITULO_SECCION) ? md.slice(md.indexOf(TITULO_SECCION)) : '');
  const camposDe = (lineas: string[]) => lineas.map((l) => l.split('|')[2]!.trim()).sort();
  const respVago = (campo: string, extra: Record<string, unknown> = {}) => ({ c: campo, d: 'correcto', s: '0.1.0', ...extra });
  const trazoD = (extra: Record<string, unknown> = {}) => respVago('trazo:Vagus_nerve.R#t01', { m: 'Vagus_nerve.R#t01', a: 'no_se', ...extra });

  describe('B1: sin la casilla, las respuestas del vago se apartan', () => {
    it('vago = no (D92): el trazo y la ruta salen solo en Descartadas, no en las tablas normales ni en los <id>.md', () => {
      const { archivos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      const resumen = archivos.get('resumen.md')!;
      for (const md of [archivos.get('vagus-nerve-x.md')!, archivos.get('m-recurrent-laryngeal-nerve.md')!, normal(resumen)]) {
        expect(camposDe(filasDe(md, 'D92')).filter((c) => c.includes('trazo'))).toEqual([]);
      }
      expect(camposDe(filasDe(archivos.get('vagus-nerve-x.md')!, 'D92'))).toEqual(['`nombre`']);
      const sec = descartadas(resumen);
      expect(camposDe(filasDe(sec, 'D92'))).toEqual(['`trazado_laringeo_recurrente_derecho`', '`trazo:Vagus_nerve.R#t01`']);
    });

    it('sin autorización (D93, no está en el CSV): lo mismo', () => {
      const { archivos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      const resumen = archivos.get('resumen.md')!;
      expect(camposDe(filasDe(archivos.get('vagus-nerve-x.md')!, 'D93'))).toEqual(['`nombre`']);
      expect(filasDe(archivos.get('m-recurrent-laryngeal-nerve.md')!, 'D93')).toEqual([]);
      expect(camposDe(filasDe(normal(resumen), 'D93'))).toEqual(['`nombre`']);
      expect(camposDe(filasDe(descartadas(resumen), 'D93'))).toEqual(['`trazado_laringeo_recurrente_derecho`', '`trazo:Vagus_nerve.R#t01`']);
    });

    it('la última fila de cada código manda: no y luego sí incluye (D91), sí y luego no descarta (D92)', () => {
      const { archivos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      const resumen = archivos.get('resumen.md')!;
      expect(camposDe(filasDe(normal(resumen), 'D91'))).toEqual(['`nombre`', '`trazado_laringeo_recurrente_derecho`', '`trazo:Vagus_nerve.R#t01`']);
      expect(filasDe(descartadas(resumen), 'D91')).toEqual([]);
      expect(filasDe(normal(resumen), 'D92').some((l) => l.includes('`trazo:'))).toBe(false);
      // El mismo CSV con las filas en el orden contrario cambia el resultado.
      const alReves = [cabeceraAut, ...autorizaciones.trim().split('\n').slice(1).reverse()].join('\n');
      const inv = importar(hojaVago, estructurasVago, padronVago, alReves).archivos.get('resumen.md')!;
      expect(filasDe(descartadas(inv), 'D91')).toHaveLength(2);
      expect(filasDe(descartadas(inv), 'D92')).toEqual([]);
    });

    it('cuenta 4 respuestas únicas con los fixtures y un reenvío de la misma clave cuenta una vez', () => {
      const r = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      expect(r.sinVago).toBe(4);
      expect(descartadas(r.archivos.get('resumen.md')!)).toContain('4 respuestas de trazos y rutas del vago');
      const [cab, vago01, novago01, sinaut01] = hojaVago.trim().split('\n');
      const reenviado = [cab, vago01, novago01, novago01, sinaut01].join('\n');
      const r2 = importar(reenviado, estructurasVago, padronVago, autorizaciones);
      expect(r2.sinVago).toBe(4);
      expect(r2.validos).toBe(r.validos + 3);
    });

    it('sin descartadas no hay sección; con una, "1 respuestas"; con varias en dos estructuras, dos ### en orden alfabético', () => {
      const ninguna = importar(csvDelCriterio(), estructuras, padron, `${cabeceraAut}\nANAT01,2026-10-15T10:00:00.000Z,1,no\n`);
      expect(ninguna.sinVago).toBe(0);
      expect(ninguna.archivos.get('resumen.md')).not.toContain('Descartadas');

      const una = importar(`${cabecera}\n${fila({ v: 2, r: 'P1', e: { 'vagus-nerve-x': [respVago('trazo:x', { m: 'x' })] } })}\n`, { 'vagus-nerve-x': { ficha: { version: '0.1.0' } } }, padron, `${cabeceraAut}\nP1,2026-10-15T10:00:00.000Z,1,no\n`);
      expect(una.sinVago).toBe(1);
      const secUna = descartadas(una.archivos.get('resumen.md')!);
      expect(secUna).toContain('1 respuestas de trazos y rutas del vago');
      expect(secUna.match(/^### /gm)).toHaveLength(1);
      expect(una.archivos.has('vagus-nerve-x.md')).toBe(false);

      const varias = descartadas(importar(hojaVago, estructurasVago, padronVago, autorizaciones).archivos.get('resumen.md')!);
      const ids = [...varias.matchAll(/^### `(.+)`$/gm)].map((m) => m[1]);
      expect(ids).toEqual(['m-recurrent-laryngeal-nerve', 'vagus-nerve-x']);
      expect(varias).toContain('Versión actual del contenido: sin-ficha');
      expect(varias).toContain('Versión actual del contenido: 0.1.0');
    });

    it.each(['trazado_derecho', 'trazado_izquierdo'])('el campo por lado %s de un código con vago = no también se descarta', (campo) => {
      const csv = `${cabecera}\n${fila({ v: 2, r: 'P1', e: { 'vagus-nerve-x': [respVago(campo)] } })}\n`;
      const r = importar(csv, estructurasVago, padron, `${cabeceraAut}\nP1,2026-10-15T10:00:00.000Z,1,no\n`);
      expect(r.sinVago).toBe(1);
      expect(filasDe(normal(r.archivos.get('resumen.md')!), 'D03')).toEqual([]);
      expect(filasDe(descartadas(r.archivos.get('resumen.md')!), 'D03')).toHaveLength(1);
    });

    it('un código fuera del padrón con respuestas del vago cuenta en desconocidos y no en sinVago', () => {
      const sinSinaut = { VAGO01: 'D91', NOVAGO01: 'D92' };
      const r = importar(hojaVago, estructurasVago, sinSinaut, autorizaciones);
      expect(r.desconocidos).toBe(2); // uno por cada estructura del envío, igual que `validos`
      expect(r.sinVago).toBe(2);
      expect(filasDe(r.archivos.get('resumen.md')!, 'D93')).toEqual([]);
    });

    it('la sección queda después de las tablas normales y su tabla tiene la cabecera de 7 columnas', () => {
      const md = importar(hojaVago, estructurasVago, padronVago, autorizaciones).archivos.get('resumen.md')!;
      const pos = md.indexOf(TITULO_SECCION);
      expect(pos).toBeGreaterThan(md.lastIndexOf('Siguiente paso'));
      const sec = descartadas(md);
      const cab = '| Revisor (alias) | Campo | Idioma | Veredicto | Propuesta | Versión revisada | Enviado |';
      expect(sec.split('\n').filter((l) => l === cab)).toHaveLength(2);
      expect(sec).not.toContain('Siguiente paso');
      for (const l of sec.split('\n').filter((x) => x.startsWith('| `D'))) expect(l.split('|')).toHaveLength(9);
    });
  });

  describe('B2: lo demás sale igual que hoy', () => {
    it('vago = sí (D91): sus respuestas del vago salen en <id>.md con la misma fila que da resumenMarkdown sin filtro', () => {
      const soloVago01 = hojaVago.trim().split('\n').slice(0, 2).join('\n');
      const { archivos } = importar(soloVago01, estructurasVago, padronVago, autorizaciones);
      const envios = aplicarPadron(leerEnvios(parsearCsv(soloVago01), new Set(Object.keys(estructurasVago))).envios, padronVago).envios;
      for (const id of ['vagus-nerve-x', 'm-recurrent-laryngeal-nerve']) {
        const esperado = resumenMarkdown(id, envios.filter((e) => e.estructura === id), id === 'vagus-nerve-x' ? '0.1.0' : 'sin-ficha');
        expect(archivos.get(`${id}.md`)).toBe(esperado);
      }
      expect(archivos.get('resumen.md')).not.toContain('Descartadas');
    });

    it('las respuestas que no son del vago de un código con vago = no (nombre, ubicacion) siguen en sus <id>.md', () => {
      const { archivos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      expect(filasDe(archivos.get('vagus-nerve-x.md')!, 'D92').some((l) => l.includes('| `nombre` |'))).toBe(true);
      expect(filasDe(archivos.get('hippocampus.md')!, 'D92')).toHaveLength(1);
      const soloUbicacion = `Recibido,Código,Estructuras,Carga\n${filaHoja({ r: 'NOVAGO01', e: { hippocampus: [{ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0' }] } }, '2026-10-15 11:05:00')}\n`;
      const aparte = importar(soloUbicacion, estructurasVago, padronVago, autorizaciones);
      expect(archivos.get('hippocampus.md')).toBe(aparte.archivos.get('hippocampus.md'));
    });

    it('un envío mixto (nombre y trazo en la misma estructura) deja nombre en <id>.md y el trazo solo en Descartadas', () => {
      const csv = `Recibido,Código,Estructuras,Carga\n${filaHoja({ r: 'NOVAGO01', e: { 'vagus-nerve-x': [{ c: 'nombre', i: 'es', d: 'correcto', s: '0.1.0' }, trazoD()] } }, '2026-10-15 11:05:00')}\n`;
      const { archivos, validos } = importar(csv, estructurasVago, padronVago, autorizaciones);
      expect(validos).toBe(1);
      const md = archivos.get('vagus-nerve-x.md')!;
      expect(md).toContain('| `nombre` |');
      expect(md).not.toContain('trazo:');
      const resumen = archivos.get('resumen.md')!;
      expect(normal(resumen)).not.toContain('trazo:');
      expect(descartadas(resumen)).toContain('| `trazo:Vagus_nerve.R#t01` |');
      expect(descartadas(resumen)).not.toContain('| `nombre` |');
    });

    it('un campo de ficha con malla o ramo también se aparta, porque la tabla dibuja el ramo y la malla', () => {
      const csv = `Recibido,Código,Estructuras,Carga\n${filaHoja({ r: 'NOVAGO01', e: { 'vagus-nerve-x': [{ c: 'nombre', d: 'corregir', m: 'Vagus_nerve.R#t01', a: 'rama_x', s: '0.1.0' }] } }, '2026-10-15 11:05:00')}\n`;
      const { archivos, sinVago } = importar(csv, estructurasVago, padronVago, autorizaciones);
      expect(sinVago).toBe(1);
      expect(archivos.has('vagus-nerve-x.md')).toBe(false);
      expect(normal(archivos.get('resumen.md')!)).not.toContain('rama_x');
      expect(descartadas(archivos.get('resumen.md')!)).toContain('ramo: `rama_x` (`Vagus_nerve.R#t01`)');
    });

    it('sin respuestas del vago los archivos son los mismos con o sin CSV de autorizaciones', () => {
      const sin = importar(csvDelCriterio(), estructuras, padron, null);
      const con = importar(csvDelCriterio(), estructuras, padron, autorizaciones);
      expect([...sin.archivos]).toEqual([...con.archivos]);
      expect([...importar(csvDelCriterio(), estructuras, padron).archivos]).toEqual([...sin.archivos]);
      expect(sin.archivos.get('resumen.md')).not.toContain('Descartadas');
      expect(con.validos).toBe(sin.validos);
      expect(con.invalidas).toBe(sin.invalidas);
      expect(con.desconocidos).toBe(sin.desconocidos);
    });

    it('el título de resumen.md cuenta solo las respuestas normales', () => {
      const { archivos, validos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      expect(archivos.get('resumen.md')).toContain('# Revisiones docentes (6 respuestas, 3 estructuras)');
      expect(validos).toBe(7);
    });
  });

  describe('B3: la entrada sigue siendo no confiable', () => {
    it('una propuesta, un comentario y una marca temporal hostiles de una descartada salen como código en línea y sin menciones', () => {
      const hostil = '[x](https://e.example) <img src=x> #123 @usuario';
      const csv = `Recibido,Código,Estructuras,Carga\n${filaHoja({ r: 'NOVAGO01', e: { 'vagus-nerve-x': [trazoD({ d: 'corregir', p: hostil, k: hostil })] } }, hostil)}\n`;
      const { archivos } = importar(csv, estructurasVago, padronVago, autorizaciones);
      const resumen = archivos.get('resumen.md')!;
      expect(normal(resumen)).not.toContain('e.example');
      const f = filasDe(descartadas(resumen), 'D92');
      expect(f).toHaveLength(1);
      expect(f[0]!.split('|')).toHaveLength(9);
      const neutral = '`[x](https://e.example) <img src=x> #123 @\u200Busuario`';
      expect(f[0]!.split(neutral)).toHaveLength(4);
      expect(f[0]).not.toMatch(/@(?!\u200B)/);
    });

    it('ningún archivo de salida contiene códigos, fechas ni la versión del CSV de autorizaciones', () => {
      const { archivos } = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      expect(archivos.size).toBeGreaterThan(3);
      for (const md of archivos.values()) {
        for (const x of ['VAGO01', 'NOVAGO01', 'SINAUT01', '2026-10-15T10:0', '9.9-prueba']) expect(md).not.toContain(x);
      }
      const sinArchivo = importar(hojaVago, estructurasVago, padronVago, null);
      for (const md of sinArchivo.archivos.values()) expect(md).not.toContain('VAGO01');
    });

    it.each([
      ['__proto__', '__proto__,2026-10-15T10:00:00.000Z,9.9-prueba,sí'],
      ['constructor', 'constructor,2026-10-15T10:00:00.000Z,9.9-prueba,sí'],
      ['código con Markdown', '[x](y),2026-10-15T10:00:00.000Z,9.9-prueba,sí'],
      ['código vacío', ',2026-10-15T10:00:00.000Z,9.9-prueba,sí'],
    ])('una fila hostil de Autorizaciones (%s) no lanza ni da vago a nadie del padrón', (_n, filaAut) => {
      let r!: ReturnType<typeof importar>;
      expect(() => {
        r = importar(hojaVago, estructurasVago, padronVago, `${cabeceraAut}\n${filaAut}\n`);
      }).not.toThrow();
      expect(r.sinVago).toBe(6);
      expect(normal(r.archivos.get('resumen.md')!)).not.toContain('trazo:');
      expect(leerAutorizaciones(parsearCsv(`${cabeceraAut}\n${filaAut}\n`)).get('VAGO01')).toBeUndefined();
    });

    it('un código como "[x](y)" o vacío se ignora y no cuenta como autorización', () => {
      expect(leerAutorizaciones(parsearCsv(`${cabeceraAut}\n[x](y),2026-10-15T10:00:00.000Z,1,sí\n`)).size).toBe(0);
      expect(leerAutorizaciones(parsearCsv(`${cabeceraAut}\n,2026-10-15T10:00:00.000Z,1,sí\n`)).size).toBe(0);
    });

    it.each([
      ['Sí', false],
      ['si', false],
      ['yes', false],
      ['SÍ', false],
      ['', false],
      ['no', false],
      ['sí', true],
      [' sí ', true],
    ])('columna D %j da vago = %s', (d, esperado) => {
      expect(leerAutorizaciones(parsearCsv(`${cabeceraAut}\nVAGO01,2026-10-15T10:00:00.000Z,1,"${d}"\n`)).get('VAGO01')).toBe(esperado);
    });

    it('una fila sin columna D da vago = false', () => {
      expect(leerAutorizaciones(parsearCsv(`${cabeceraAut}\nVAGO01,2026-10-15T10:00:00.000Z,1\n`)).get('VAGO01')).toBe(false);
    });

    it('la primera fila siempre se salta, como en el script', () => {
      const sinCabecera = 'VAGO01,2026-10-15T10:00:00.000Z,1,sí\n';
      expect(leerAutorizaciones(parsearCsv(sinCabecera)).size).toBe(0);
      expect(importar(hojaVago, estructurasVago, padronVago, sinCabecera).sinVago).toBe(6);
    });

    it('lee la última fila de cada código y devuelve un Map', () => {
      const m = leerAutorizaciones(parsearCsv(autorizaciones));
      expect(m).toBeInstanceOf(Map);
      expect([...m]).toEqual([['VAGO01', true], ['NOVAGO01', false]]);
    });

    it('un alias repetido en un padrón sin validar solo puede con el vago si todos sus códigos tienen sí', () => {
      // El resultado no depende del orden de las llaves del padrón.
      for (const repetido of [{ VAGO01: 'D91', NOVAGO01: 'D91' }, { NOVAGO01: 'D91', VAGO01: 'D91' }]) {
        const r = importar(hojaVago, estructurasVago, repetido, autorizaciones);
        expect(r.sinVago).toBe(2); // un alias, dos respuestas únicas (trazo y ruta), ninguna se aplica
      }
    });
  });

  describe('D2: sin el CSV de Autorizaciones', () => {
    it('todas las respuestas del vago van a Descartadas, también las de D91, con la frase literal', () => {
      const r = importar(hojaVago, estructurasVago, padronVago, null);
      expect(r.sinVago).toBe(6);
      expect(r.autorizaciones).toBeNull();
      const resumen = r.archivos.get('resumen.md')!;
      expect(descartadas(resumen)).toContain(FRASE_SIN_ARCHIVO);
      expect(filasDe(normal(resumen), 'D91').some((l) => l.includes('trazo'))).toBe(false);
      expect(filasDe(descartadas(resumen), 'D91')).toHaveLength(2);
      expect(normal(resumen)).toContain('(4 respuestas, 2 estructuras)');
    });

    it('con el CSV la frase no aparece y autorizaciones cuenta los códigos distintos', () => {
      const r = importar(hojaVago, estructurasVago, padronVago, autorizaciones);
      expect(r.archivos.get('resumen.md')).not.toContain(FRASE_SIN_ARCHIVO);
      expect(r.autorizaciones).toBe(2);
    });

    it('un CSV con solo la cabecera da autorizaciones = 0 y descarta todo', () => {
      const r = importar(hojaVago, estructurasVago, padronVago, `${cabeceraAut}\n`);
      expect(r.autorizaciones).toBe(0);
      expect(r.sinVago).toBe(6);
      expect(r.archivos.get('resumen.md')).not.toContain(FRASE_SIN_ARCHIVO);
    });

    it('sin descartadas ni archivo, resumen.md no menciona la frase', () => {
      expect(importar(csvDelCriterio(), estructuras, padron, null).archivos.get('resumen.md')).not.toContain(FRASE_SIN_ARCHIVO);
    });
  });

  describe('D1: argumentosImportar', () => {
    it('acepta el CSV, el padrón y la bandera en cualquier posición', () => {
      expect(argumentosImportar(['a.csv'])).toEqual({ csv: 'a.csv' });
      expect(argumentosImportar(['a.csv', 'p.json'])).toEqual({ csv: 'a.csv', padron: 'p.json' });
      expect(argumentosImportar(['a.csv', '--autorizaciones', 'b.csv'])).toEqual({ csv: 'a.csv', autorizaciones: 'b.csv' });
      expect(argumentosImportar(['--autorizaciones', 'b.csv', 'a.csv', 'p.json'])).toEqual({ csv: 'a.csv', padron: 'p.json', autorizaciones: 'b.csv' });
      expect(argumentosImportar(['a.csv', 'p.json', '--autorizaciones', 'b.csv'])).toEqual({ csv: 'a.csv', padron: 'p.json', autorizaciones: 'b.csv' });
    });

    it.each([
      ['sin argumentos', []],
      ['sin CSV', ['--autorizaciones', 'b.csv']],
      ['bandera sin valor', ['a.csv', '--autorizaciones']],
      ['bandera seguida de otra bandera', ['a.csv', '--autorizaciones', '--x']],
      ['bandera con valor vacío', ['a.csv', '--autorizaciones', '']],
      ['bandera repetida', ['a.csv', '--autorizaciones', 'b.csv', '--autorizaciones', 'c.csv']],
      ['bandera desconocida', ['a.csv', '--otra']],
      ['tres posicionales', ['a.csv', 'p.json', 'c']],
    ])('uso indebido (%s) da null', (_n, args) => {
      expect(argumentosImportar(args)).toBeNull();
    });
  });

  describe('esRespuestaDelVago y separarSinVago', () => {
    it.each([
      ['trazo:Vagus_nerve.R#t01', true],
      ['trazado_derecho', true],
      ['trazado_izquierdo', true],
      ['trazado_vago_toracico_derecho', true],
      ['trazado_laringeo_recurrente_izquierdo', true],
      ['nombre', false],
      ['que_es', false],
      ['posicion', false],
      ['relevancia.0', false],
    ])('el campo %s: %s', (campo, esperado) => {
      expect(esRespuestaDelVago({ campo })).toBe(esperado);
    });

    it('cualquier campo con malla o ramo cuenta como del vago', () => {
      expect(esRespuestaDelVago({ campo: 'nombre', malla: 'm' })).toBe(true);
      expect(esRespuestaDelVago({ campo: 'nombre', ramo: 'no_se' })).toBe(true);
    });

    it('no muta la entrada y deja pasar entero el envío de quien puede', () => {
      const r = (campo: string): Respuesta => ({ estructura: 'vagus-nerve-x', campo, veredicto: 'correcto', version: '0.1.0', fecha: '' });
      const entrada: Envio[] = [
        { revisor: 'D01', estructura: 'vagus-nerve-x', marcaTemporal: 'a', respuestas: [r('nombre'), r('trazo:x')] },
        { revisor: 'D02', estructura: 'vagus-nerve-x', marcaTemporal: 'b', respuestas: [r('trazado_derecho')] },
        { revisor: 'D03', estructura: 'vagus-nerve-x', marcaTemporal: 'c', respuestas: [r('nombre')] },
      ];
      const copia = structuredClone(entrada);
      const { envios, sinVago } = separarSinVago(entrada, (a) => a === 'D03');
      expect(entrada).toEqual(copia);
      expect(envios.map((e) => [e.revisor, e.respuestas.map((x) => x.campo)])).toEqual([
        ['D01', ['nombre']],
        ['D03', ['nombre']],
      ]);
      expect(sinVago.map((e) => [e.revisor, e.respuestas.map((x) => x.campo)])).toEqual([
        ['D01', ['trazo:x']],
        ['D02', ['trazado_derecho']],
      ]);
      expect(separarSinVago(entrada, () => true)).toEqual({ envios: entrada, sinVago: [] });
    });
  });
});
