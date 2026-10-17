import { describe, expect, it, vi } from 'vitest';
import { claveGuiaVista, claveRevisionIdb } from '../src/lib/huella';
import {
  borrarDeEsteEquipo,
  busquedaSinCodigo,
  CLAVE_REVISOR,
  codigoRetirado,
  escucharRetiroDelCodigo,
  olvidarRevisor,
  pedirPersistencia,
  recordarRevisor,
  revisorRecordado,
} from '../src/lib/persistencia';

const falso = (inicial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(inicial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const quePeta = () => {
  const peta = () => {
    throw new Error('bloqueado');
  };
  return { getItem: peta, setItem: peta, removeItem: peta };
};

describe('código del revisor recordado', () => {
  it('recordar escribe en local y limpia la copia de sesión', () => {
    const local = falso();
    const sesion = falso({ [CLAVE_REVISOR]: 'VIEJO' });
    recordarRevisor('ABC', local, sesion);
    expect(local.getItem(CLAVE_REVISOR)).toBe('ABC');
    expect(sesion.getItem(CLAVE_REVISOR)).toBeNull();
  });

  it.each(['', 'A'.repeat(41), '<script>', 'D03 ok'])('recordarRevisor no guarda un código inválido: %j', (invalido) => {
    const local = falso();
    const sesion = falso({ [CLAVE_REVISOR]: 'SESION' });
    recordarRevisor(invalido, local, sesion);
    expect(local.getItem(CLAVE_REVISOR)).toBeNull();
    expect(sesion.getItem(CLAVE_REVISOR)).toBe('SESION');

    const conPrevio = falso({ [CLAVE_REVISOR]: 'PREVIO' });
    recordarRevisor(invalido, conPrevio, sesion);
    expect(conPrevio.getItem(CLAVE_REVISOR)).toBe('PREVIO');
    expect(sesion.getItem(CLAVE_REVISOR)).toBe('SESION');
  });

  it.each(['D03-ok', 'A'.repeat(40)])('recordarRevisor guarda un código válido: %s', (valido) => {
    const local = falso();
    recordarRevisor(valido, local, falso());
    expect(local.getItem(CLAVE_REVISOR)).toBe(valido);
  });

  it.each<[string, ReturnType<typeof falso> | null, ReturnType<typeof falso> | null, string | null]>([
    ['lee de local primero', falso({ [CLAVE_REVISOR]: 'LOCAL' }), falso({ [CLAVE_REVISOR]: 'SESION' }), 'LOCAL'],
    ['sin local cae a sesión', falso(), falso({ [CLAVE_REVISOR]: 'SESION' }), 'SESION'],
    ['un valor vacío cuenta como ausente', falso({ [CLAVE_REVISOR]: '' }), falso(), null],
    ['sin ninguno', falso(), falso(), null],
    ['almacenes nulos', null, null, null],
    ['almacenes que lanzan', quePeta(), quePeta(), null],
    ['un valor inválido en local con sesión vacía da null', falso({ [CLAVE_REVISOR]: '<script>' }), falso(), null],
    ['un valor de 41 caracteres en local da null', falso({ [CLAVE_REVISOR]: 'A'.repeat(41) }), falso(), null],
    ['un valor con espacio en local da null', falso({ [CLAVE_REVISOR]: 'con espacio' }), falso(), null],
    ['local inválido cae a la sesión válida', falso({ [CLAVE_REVISOR]: '<script>' }), falso({ [CLAVE_REVISOR]: 'SESION' }), 'SESION'],
    ['un valor de 40 caracteres en local es válido', falso({ [CLAVE_REVISOR]: 'A'.repeat(40) }), falso(), 'A'.repeat(40)],
  ])('revisorRecordado: %s', (_n, local, sesion, esperado) => {
    expect(revisorRecordado(local, sesion)).toBe(esperado);
  });

  it('olvidar borra de los dos y no lanza si el almacén lanza', () => {
    const local = falso({ [CLAVE_REVISOR]: 'A' });
    const sesion = falso({ [CLAVE_REVISOR]: 'B' });
    olvidarRevisor(local, sesion);
    expect([local.getItem(CLAVE_REVISOR), sesion.getItem(CLAVE_REVISOR)]).toEqual([null, null]);
    expect(() => olvidarRevisor(quePeta(), quePeta())).not.toThrow();
    expect(() => recordarRevisor('A', quePeta(), quePeta())).not.toThrow();
  });
});

describe('pedirPersistencia', () => {
  const doble = (persisted: () => Promise<boolean>, persist: () => Promise<boolean>) => ({ persisted: vi.fn(persisted), persist: vi.fn(persist) });

  it.each<[string, () => Parameters<typeof pedirPersistencia>[0], boolean, number]>([
    ['sin storage', () => null, false, 0],
    ['storage sin persist', () => ({}), false, 0],
    ['ya es persistente: no vuelve a pedir', () => doble(async () => true, async () => false), true, 0],
    ['persist concede', () => doble(async () => false, async () => true), true, 1],
    ['persist niega', () => doble(async () => false, async () => false), false, 1],
    ['persist rechaza', () => doble(async () => false, () => Promise.reject(new Error('no'))), false, 1],
    [
      'persist lanza síncrono',
      () =>
        doble(async () => false, () => {
          throw new Error('no');
        }),
      false,
      1,
    ],
  ])('%s', async (_n, hacer, esperado, llamadas) => {
    const storage = hacer();
    await expect(pedirPersistencia(storage)).resolves.toBe(esperado);
    if (storage && 'persist' in storage) expect((storage.persist as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(llamadas);
  });
});

describe('busquedaSinCodigo (S5, #149)', () => {
  it.each([
    ['?r=X', ''],
    ['?r=X&a=1', '?a=1'],
    ['?a=1&r=X&b=2', '?a=1&b=2'],
    ['', ''],
    ['?a=1', '?a=1'],
    ['?r=', ''],
  ])('%j da %j', (entrada, esperado) => {
    expect(busquedaSinCodigo(entrada)).toBe(esperado);
  });
});

describe('codigoRetirado', () => {
  const con = (codigo: string | null) => falso(codigo ? { [CLAVE_REVISOR]: codigo } : {});
  it('false si el almacén local todavía guarda el código', () => {
    expect(codigoRetirado('ABC', con('ABC'), con(null))).toBe(false);
  });
  it('false si solo la sesión lo guarda (pestaña anterior al cambio)', () => {
    expect(codigoRetirado('ABC', con(null), con('ABC'))).toBe(false);
  });
  it('true si ninguno de los dos lo guarda', () => {
    expect(codigoRetirado('ABC', con(null), con(null))).toBe(true);
  });
  it('true si el local guarda otro código', () => {
    expect(codigoRetirado('ABC', con('OTRO'), con(null))).toBe(true);
  });
  it('false si no se puede leer ningún almacén (no se sabe, se permite escribir)', () => {
    expect(codigoRetirado('ABC', null, null)).toBe(false);
    expect(codigoRetirado('ABC', quePeta(), quePeta())).toBe(false);
  });
  it('true si uno lanza y el legible no lo tiene', () => {
    expect(codigoRetirado('ABC', quePeta(), con(null))).toBe(true);
    expect(codigoRetirado('ABC', con(null), quePeta())).toBe(true);
  });
  it('false si uno lanza y el legible sí lo tiene', () => {
    expect(codigoRetirado('ABC', quePeta(), con('ABC'))).toBe(false);
  });
});

describe('borrarDeEsteEquipo (S6, #149)', () => {
  const sembrar = () =>
    falso({
      [claveGuiaVista('BORRA01')]: '1',
      'atlas:guia-vista:BORRA01': '1',
      [claveGuiaVista('OTRO01')]: '1',
      'atlas:guia-vista:OTRO01': '1',
    });

  it('quita la guía con huella y en claro de ese código y deja la de otro', async () => {
    const local = sembrar();
    await borrarDeEsteEquipo('BORRA01', local, async () => undefined);
    expect(local.getItem(claveGuiaVista('BORRA01'))).toBeNull();
    expect(local.getItem('atlas:guia-vista:BORRA01')).toBeNull();
    expect(local.getItem(claveGuiaVista('OTRO01'))).toBe('1');
    expect(local.getItem('atlas:guia-vista:OTRO01')).toBe('1');
  });

  it('borra de IndexedDB la llave con huella y la vieja en claro, en una sola llamada y esperándola', async () => {
    const llamadas: string[][] = [];
    let termino = false;
    await borrarDeEsteEquipo('BORRA01', sembrar(), async (claves) => {
      llamadas.push(claves);
      await Promise.resolve();
      termino = true;
    });
    expect(llamadas).toEqual([[claveRevisionIdb('BORRA01'), 'revision:BORRA01']]);
    expect(termino).toBe(true);
  });

  it('con un almacén local que lanza, igual borra IndexedDB', async () => {
    const llamadas: string[][] = [];
    await borrarDeEsteEquipo('BORRA01', quePeta(), async (claves) => void llamadas.push(claves));
    expect(llamadas).toHaveLength(1);
  });

  it('con IndexedDB que rechaza o lanza, resuelve igual', async () => {
    await expect(borrarDeEsteEquipo('BORRA01', sembrar(), () => Promise.reject(new Error('no')))).resolves.toBeUndefined();
    await expect(
      borrarDeEsteEquipo('BORRA01', sembrar(), () => {
        throw new Error('no');
      }),
    ).resolves.toBeUndefined();
  });
});

describe('escucharRetiroDelCodigo (S3, #149)', () => {
  type Oyente = (e: unknown) => void;
  const ventanaFalsa = () => {
    const oyentes = new Map<string, Oyente[]>();
    return {
      oyentes,
      addEventListener: (tipo: string, f: Oyente) => void oyentes.set(tipo, [...(oyentes.get(tipo) ?? []), f]),
      removeEventListener: (tipo: string, f: Oyente) =>
        void oyentes.set(
          tipo,
          (oyentes.get(tipo) ?? []).filter((x) => x !== f),
        ),
      emitir: (tipo: string, e: unknown) => (oyentes.get(tipo) ?? []).forEach((f) => f(e)),
    };
  };
  const montar = (actual: string | null, retirado = () => false) => {
    const v = ventanaFalsa();
    let n = 0;
    const quitar = escucharRetiroDelCodigo(
      () => actual,
      () => void n++,
      v as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
      retirado,
    );
    return { v, quitar, llamadas: () => n };
  };

  it('storage de atlas:revisor sin valor nuevo: retira', () => {
    const { v, llamadas } = montar('ABC');
    v.emitir('storage', { key: CLAVE_REVISOR, newValue: null });
    expect(llamadas()).toBe(1);
  });
  it('storage con el mismo código: no retira', () => {
    const { v, llamadas } = montar('ABC');
    v.emitir('storage', { key: CLAVE_REVISOR, newValue: 'ABC' });
    expect(llamadas()).toBe(0);
  });
  it('storage con otro código: retira', () => {
    const { v, llamadas } = montar('ABC');
    v.emitir('storage', { key: CLAVE_REVISOR, newValue: 'OTRO' });
    expect(llamadas()).toBe(1);
  });
  it('storage con key null (localStorage.clear): retira', () => {
    const { v, llamadas } = montar('ABC');
    v.emitir('storage', { key: null, newValue: null });
    expect(llamadas()).toBe(1);
  });
  it('storage de otra llave: no retira', () => {
    const { v, llamadas } = montar('ABC');
    v.emitir('storage', { key: 'otra', newValue: null });
    expect(llamadas()).toBe(0);
  });
  it('sin código actual no retira nada', () => {
    const { v, llamadas } = montar(null, () => true);
    v.emitir('storage', { key: CLAVE_REVISOR, newValue: null });
    v.emitir('storage', { key: null, newValue: null });
    v.emitir('pageshow', { persisted: true });
    expect(llamadas()).toBe(0);
  });
  it('pageshow desde el bfcache con el código ya retirado: retira', () => {
    const { v, llamadas } = montar('ABC', () => true);
    v.emitir('pageshow', { persisted: true });
    expect(llamadas()).toBe(1);
  });
  it('pageshow desde el bfcache con el código aún recordado: no retira', () => {
    const { v, llamadas } = montar('ABC', () => false);
    v.emitir('pageshow', { persisted: true });
    expect(llamadas()).toBe(0);
  });
  it('pageshow sin persisted no retira', () => {
    const { v, llamadas } = montar('ABC', () => true);
    v.emitir('pageshow', { persisted: false });
    expect(llamadas()).toBe(0);
  });
  it('sin el cuarto parámetro, pageshow consulta los almacenes reales (codigoRetirado)', () => {
    const v = ventanaFalsa();
    let n = 0;
    escucharRetiroDelCodigo(() => 'ABC', () => void n++, v as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>);
    vi.stubGlobal('localStorage', falso({ [CLAVE_REVISOR]: 'ABC' }));
    vi.stubGlobal('sessionStorage', falso());
    v.emitir('pageshow', { persisted: true });
    expect(n).toBe(0);
    vi.stubGlobal('localStorage', falso());
    v.emitir('pageshow', { persisted: true });
    expect(n).toBe(1);
    vi.unstubAllGlobals();
  });
  it('la función devuelta quita los dos oyentes', () => {
    const { v, quitar, llamadas } = montar('ABC', () => true);
    expect(v.oyentes.get('storage')).toHaveLength(1);
    expect(v.oyentes.get('pageshow')).toHaveLength(1);
    quitar();
    expect(v.oyentes.get('storage')).toHaveLength(0);
    expect(v.oyentes.get('pageshow')).toHaveLength(0);
    v.emitir('storage', { key: null, newValue: null });
    expect(llamadas()).toBe(0);
  });
});
