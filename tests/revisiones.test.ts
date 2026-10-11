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
    expect(filas[0]!.split('|')).toHaveLength(8); // vacío + seis columnas + vacío
    expect(filas[0]).toContain('| P/1 X | ub/ic acion | es | correcto |');
    expect(filas[0]).toContain('9/9 9 (desactualizada)');
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
