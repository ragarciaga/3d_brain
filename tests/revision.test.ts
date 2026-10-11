import { describe, expect, it } from 'vitest';
import { claveRespuesta, desactualizadas, MAX_URL, urlFormulario, type Respuesta } from '../src/lib/revision';

const config = {
  urlFormulario: 'https://docs.google.com/forms/d/e/abc/viewform',
  campos: { codigo: 'entry.1', estructura: 'entry.2', revision: 'entry.3' },
};
const r = (campo: string, version = '0.1.0'): Respuesta => ({
  estructura: 'hippocampus',
  campo,
  idioma: 'es',
  veredicto: 'correcto',
  version,
  fecha: '2026-10-11T00:00:00Z',
});

describe('revisión docente (F24)', () => {
  it('la clave separa estructura, campo e idioma', () => {
    expect(claveRespuesta({ estructura: 'a', campo: 'ubicacion', idioma: 'es' })).not.toBe(
      claveRespuesta({ estructura: 'a', campo: 'ubicacion', idioma: 'en' }),
    );
  });

  it('arma la URL prellenada del formulario con código, estructura y revisión', () => {
    const url = urlFormulario(config, 'PROF01', 'hippocampus', [r('ubicacion')])!;
    const p = new URL(url).searchParams;
    expect(p.get('entry.1')).toBe('PROF01');
    expect(p.get('entry.2')).toBe('hippocampus');
    expect(JSON.parse(p.get('entry.3')!).respuestas[0].campo).toBe('ubicacion');
  });

  it('sin configuración no hay URL (la app ofrece copiar o descargar)', () => {
    expect(urlFormulario({ ...config, urlFormulario: '' }, 'P', 'h', [r('x')])).toBeNull();
  });

  it('si la revisión es demasiado larga para una URL, devuelve null', () => {
    const muchas = Array.from({ length: 200 }, (_, i) => ({ ...r(`campo.${i}`), propuesta: 'x'.repeat(50) }));
    expect(urlFormulario(config, 'P', 'h', muchas)).toBeNull();
    expect(MAX_URL).toBeLessThan(8000);
  });

  it('marca respuestas sobre una versión vieja del contenido', () => {
    expect(desactualizadas([r('a', '0.1.0'), r('b', '0.2.0')], () => '0.2.0').map((x) => x.campo)).toEqual(['a']);
  });
});

describe('envío en partes', () => {
  it('una revisión larga se parte en varias URL que caben en el límite y no pierden respuestas', async () => {
    const { urlsFormulario } = await import('../src/lib/revision');
    const muchas = Array.from({ length: 120 }, (_, i) => ({ ...r(`campo.${i}`), propuesta: 'ñ'.repeat(40) }));
    const urls = urlsFormulario(config, 'P', 'h', muchas);
    expect(urls.length).toBeGreaterThan(1);
    expect(urls.every((u) => u.length <= MAX_URL)).toBe(true);
    const total = urls.reduce((n, u) => n + JSON.parse(new URL(u).searchParams.get('entry.3')!).respuestas.length, 0);
    expect(total).toBe(120);
  });
});
