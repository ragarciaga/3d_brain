import { describe, expect, it, vi } from 'vitest';
import { CLAVE_REVISOR, olvidarRevisor, pedirPersistencia, recordarRevisor, revisorRecordado } from '../src/lib/persistencia';

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
