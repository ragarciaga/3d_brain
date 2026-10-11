import { describe, expect, it } from 'vitest';
import { leerEnvios, parsearCsv, resumenMarkdown } from '../scripts/lib/revisiones.ts';

const carga = JSON.stringify({
  v: 1,
  revisor: 'PROF01',
  estructura: 'hippocampus',
  respuestas: [
    { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'corregir', propuesta: 'Texto, con coma', version: '0.1.0', fecha: 'x' },
  ],
});
const csv = `Marca temporal,Código,Estructura,Revisión,Nombre\n2026-10-11 10:00,PROF01,hippocampus,"${carga.replace(/"/g, '""')}",Ana\n`;

describe('importar revisiones (F24)', () => {
  it('lee el CSV de Google con comillas y comas dentro de la celda JSON', () => {
    const { envios, invalidas } = leerEnvios(parsearCsv(csv));
    expect(invalidas).toBe(0);
    expect(envios[0]!.respuestas[0]!.propuesta).toBe('Texto, con coma');
  });

  it('el resumen usa el código del revisor, no su nombre, y marca versiones viejas', () => {
    const { envios } = leerEnvios(parsearCsv(csv));
    const md = resumenMarkdown('hippocampus', envios, '0.2.0');
    expect(md).toContain('PROF01');
    expect(md).not.toContain('Ana');
    expect(md).toContain('(desactualizada)');
  });
});

describe('reenvíos', () => {
  it('queda solo la respuesta más reciente por revisor, campo e idioma', async () => {
    const { ultimasRespuestas } = await import('../scripts/lib/revisiones.ts');
    const base = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es' as const, version: '0.1.0', fecha: 'x' };
    const envios = [
      { revisor: 'P1', estructura: 'hippocampus', marcaTemporal: '1', respuestas: [{ ...base, veredicto: 'corregir' as const }] },
      { revisor: 'P1', estructura: 'hippocampus', marcaTemporal: '2', respuestas: [{ ...base, veredicto: 'correcto' as const }] },
    ];
    const u = ultimasRespuestas(envios);
    expect(u).toHaveLength(1);
    expect(u[0]!.r.veredicto).toBe('correcto');
  });
});
