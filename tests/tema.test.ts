import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_TEMA, elegirTema, seguirSistema, temaInicial } from '../src/lib/tema';

function entorno(guardado: string | null, sistemaOscuro: boolean, bloqueado = false) {
  const datos = new Map<string, string>(guardado ? [[CLAVE_TEMA, guardado]] : []);
  const oyentes: (() => void)[] = [];
  const mq = {
    matches: sistemaOscuro,
    addEventListener: (_: string, f: () => void) => oyentes.push(f),
    removeEventListener: () => {},
  };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (bloqueado) throw new Error('bloqueado');
      return datos.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (bloqueado) throw new Error('bloqueado');
      datos.set(k, v);
    },
  });
  vi.stubGlobal('matchMedia', () => mq);
  const raiz = { dataset: {} as Record<string, string> };
  vi.stubGlobal('document', { documentElement: raiz });
  return { datos, mq, oyentes, raiz };
}

describe('tema claro u oscuro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin elección sigue al sistema', () => {
    entorno(null, true);
    expect(temaInicial()).toBe('oscuro');
    entorno(null, false);
    expect(temaInicial()).toBe('claro');
  });

  it('la elección guardada manda sobre el sistema, y un valor raro se ignora', () => {
    entorno('claro', true);
    expect(temaInicial()).toBe('claro');
    entorno('morado', true);
    expect(temaInicial()).toBe('oscuro');
  });

  it('elegir aplica el tema en <html> y lo guarda', () => {
    const { datos, raiz } = entorno(null, false);
    elegirTema('oscuro');
    expect(raiz.dataset.tema).toBe('oscuro');
    expect(datos.get(CLAVE_TEMA)).toBe('oscuro');
  });

  it('con el almacenamiento bloqueado no falla: aplica el tema y usa el del sistema', () => {
    const { raiz } = entorno(null, true, true);
    expect(temaInicial()).toBe('oscuro');
    elegirTema('claro');
    expect(raiz.dataset.tema).toBe('claro');
  });

  it('los cambios del sistema solo cuentan mientras la persona no haya elegido', () => {
    const e = entorno(null, false);
    const vistos: string[] = [];
    seguirSistema((t) => vistos.push(t));
    e.mq.matches = true;
    e.oyentes.forEach((f) => f());
    expect(vistos).toEqual(['oscuro']);
    elegirTema('claro');
    e.mq.matches = false;
    e.oyentes.forEach((f) => f());
    expect(vistos).toEqual(['oscuro']);
    expect(e.raiz.dataset.tema).toBe('claro');
  });
});
