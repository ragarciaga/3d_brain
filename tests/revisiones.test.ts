import { describe, expect, it } from 'vitest';
import { importar, leerEnvios, parsearCsv, resumenConsolidado, resumenMarkdown, ultimasRespuestas, type Envio } from '../scripts/lib/revisiones.ts';
import { urlFormulario, type Respuesta } from '../src/lib/revision';

const fila = (carga: object, nombre = 'Ana') => `2026-10-11 10:00,X,Y,"${JSON.stringify(carga).replace(/"/g, '""')}",${nombre}`;
const cabecera = 'Marca temporal,Código,Estructura,Revisión,Nombre';
const base = { idioma: 'es' as const, version: '0.1.0', fecha: 'x' };
const estructuras = {
  hippocampus: { ficha: { version: '0.1.0' } },
  'm-periaqueductal-grey': { ficha: null },
};

/** El escenario del criterio F24, tal como la app lo manda al formulario y queda en la hoja. */
function csvDelCriterio(): string {
  const config = { urlFormulario: 'https://docs.google.com/forms/d/e/abc/viewform', campos: { codigo: 'entry.1', estructura: 'entry.2', revision: 'entry.3' } };
  const ficha: Respuesta[] = [
    { ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' },
    { ...base, estructura: 'hippocampus', campo: 'que_es', veredicto: 'correcto' },
    { ...base, estructura: 'hippocampus', campo: 'para_que_sirve', veredicto: 'correcto' },
    { ...base, estructura: 'hippocampus', campo: 'relaciones', idioma: undefined, veredicto: 'corregir', propuesta: 'Agregar el subículo' },
  ];
  const marcador: Respuesta[] = [
    { estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [0.00123, 1.61234, -0.01987], version: 'sin-ficha', fecha: 'x' },
  ];
  const celda = (rs: Respuesta[], est: string) => new URL(urlFormulario(config, 'ANAT01', est, rs)!).searchParams.get('entry.3')!;
  return `${cabecera}\n${fila(JSON.parse(celda(ficha, 'hippocampus')))}\n${fila(JSON.parse(celda(marcador, 'm-periaqueductal-grey')))}\n`;
}

function verificarCinco(md: string): void {
  expect(md).toContain('5 respuestas, 2 estructuras');
  const filas = md.split('\n').filter((l) => l.startsWith('| ANAT01 |'));
  expect(filas).toHaveLength(5);
  expect(md).toContain('posición 0.00123, 1.61234, -0.01987');
  expect(md).toContain('Agregar el subículo');
  for (const campo of ['ubicacion', 'que_es', 'para_que_sirve']) expect(filas.some((l) => l.includes(`| ${campo} | es | correcto |`))).toBe(true);
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
    const { archivos, validos, invalidas } = importar(csvDelCriterio(), estructuras);
    expect(validos).toBe(2);
    expect(invalidas).toBe(0);
    expect([...archivos.keys()].sort()).toEqual(['hippocampus.md', 'm-periaqueductal-grey.md', 'resumen.md']);
    verificarCinco(archivos.get('resumen.md')!);
    expect(archivos.get('hippocampus.md')).toContain('Agregar el subículo');
    expect(archivos.get('hippocampus.md')).not.toContain('posición 0.00123');
    expect(archivos.get('m-periaqueductal-grey.md')).toContain('posición 0.00123, 1.61234, -0.01987');
  });

  it('importar() no genera archivo para un id desconocido ni para uno con forma de ruta', () => {
    const ok = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' }] };
    const desconocido = { v: 1, revisor: 'P1', estructura: 'no-existe', respuestas: [{ ...base, estructura: 'no-existe', campo: 'a', veredicto: 'correcto' }] };
    const ruta = { v: 1, revisor: 'P1', estructura: '../../../AGENTS', respuestas: [{ ...base, estructura: '../../../AGENTS', campo: 'a', veredicto: 'correcto' }] };
    const mezclada = { v: 1, revisor: 'P1', estructura: 'hippocampus', respuestas: [{ ...base, estructura: 'no-existe', campo: 'a', veredicto: 'correcto' }] };
    const { archivos, validos, invalidas } = importar(`${cabecera}\n${fila(ok)}\n${fila(desconocido)}\n${fila(ruta)}\n${fila(mezclada)}\n`, estructuras);
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
    const filas = md.split('\n').filter((l) => l.startsWith('| P'));
    expect(filas).toHaveLength(1);
    expect(filas[0]!.split('|')).toHaveLength(9); // vacío + siete columnas + vacío
    expect(filas[0]).toContain('| P/1 X | ub/ic acion | es | correcto |');
    expect(filas[0]).toContain('9/9 9 (desactualizada)');
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
    const { validos, invalidas, archivos } = importar(csv, estructuras);
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
  const fila1 = (md: string) => md.split('\n').find((l) => l.startsWith('| P1 |'))!;

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
    expect(fila1(md)).toMatch(/\| 2026-10-11 10:00 \|$/);
  });

  it('la marca temporal es la del envío más reciente de cada respuesta', () => {
    const md = resumenMarkdown('hippocampus', [env({ veredicto: 'corregir' }, 'T1'), env({ veredicto: 'correcto' }, 'T2')], '0.1.0');
    const filas = md.split('\n').filter((l) => l.startsWith('| P1 |'));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatch(/\| T2 \|$/);
    expect(filas[0]).toContain('| correcto |');
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
