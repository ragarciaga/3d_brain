import { describe, expect, it } from 'vitest';
import {
  armarLotes,
  AVISO_RESPALDO_MS,
  claveConfirmacion,
  confirmarRecibidas,
  ESPERA_CANAL_MS,
  ESPERA_DEMASIADAS_MS,
  estadoInicial,
  fusionarConCanal,
  marcarPendientes,
  MAX_LOTE_BYTES,
  MAX_LOTE_RESPUESTAS,
  ofrecerRespaldo,
  pendientes,
  porEnviar,
  siguienteEspera,
  trasEnvio,
  type EstadoCola,
  type ResultadoEnvio,
} from '../src/lib/colaGuardado';
import { cuerpoGuardar } from '../src/lib/canal';
import { claveRespuesta, ESPERA_GUARDADO_MS, type Respuesta } from '../src/lib/revision';

const CODIGO = 'D03-ok_1';
const a: Respuesta = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-10T10:00:00.000Z' };
const b: Respuesta = { estructura: 'thalamus', campo: 'que_es', idioma: 'es', veredicto: 'corregir', propuesta: 'Texto', version: '0.1.0', fecha: '2026-10-10T11:00:00.000Z' };
const T0 = 1_000_000;
const MIN = 60_000;
const kA = claveRespuesta(a);
const kB = claveRespuesta(b);
const claves = (...l: Respuesta[]) => new Set(l.map(claveConfirmacion));
const recibe = (...l: Respuesta[]): ResultadoEnvio => ({ ok: true, recibidas: claves(...l) });
const falla = (error: Extract<ResultadoEnvio, { ok: false }>['error']): ResultadoEnvio => ({ ok: false, error });
const corta = (i: number): Respuesta => ({ estructura: 'hippocampus', campo: `relevancia.${i}`, veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-10T10:00:00.000Z' });
const larga = (i: number, n: number): Respuesta => ({ ...corta(i), veredicto: 'corregir', comentario: 'x'.repeat(n) });
const bytes = (l: Respuesta[]) => new TextEncoder().encode(cuerpoGuardar(CODIGO, l)).length;

describe('constantes', () => {
  it('la espera del canal es 3 s y no es la del guardado local', () => {
    expect(ESPERA_CANAL_MS).toBe(3000);
    expect(ESPERA_CANAL_MS).not.toBe(ESPERA_GUARDADO_MS);
  });
});

describe('siguienteEspera', () => {
  it.each([
    [0, 2000],
    [1, 2000],
    [2, 4000],
    [3, 8000],
    [8, 256_000],
    [9, 300_000],
    [100, 300_000],
    [5000, 300_000],
    [Number.NaN, 2000],
    [Number.POSITIVE_INFINITY, 2000],
  ])('con %s fallos espera %s ms', (n, ms) => {
    expect(siguienteEspera(n)).toBe(ms);
  });
});

describe('reintentos (R3.4)', () => {
  it.each(['red', 'interno'] as const)('%s: tres fallos esperan 2000, 4000 y 8000 y el lote sigue por enviar', (error) => {
    let e: EstadoCola = estadoInicial();
    const esperas: (number | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = trasEnvio(e, [a], falla(error), T0 + i);
      e = r.estado;
      esperas.push(r.espera);
    }
    expect(esperas).toEqual([2000, 4000, 8000]);
    expect(e.fallos).toBe(3);
    expect(e.confirmadas).toEqual({});
    expect(porEnviar([a], e.confirmadas, e.rechazadas)).toEqual([a]);
  });

  it('un ok que confirma todo después de fallar reinicia los fallos y no espera', () => {
    let e = trasEnvio(estadoInicial(), [a], falla('red'), T0).estado;
    e = trasEnvio(e, [a], falla('red'), T0).estado;
    const r = trasEnvio(e, [a], recibe(a), T0 + 5);
    expect(r.espera).toBe(0);
    expect(r.estado.fallos).toBe(0);
    expect(r.estado.confirmadas).toEqual({ [kA]: a.fecha });
    expect(r.estado.ultimaConfirmacion).toBe(T0 + 5);
  });

  it('demasiadas_peticiones espera 60000 y no cambia fallos ni confirmadas', () => {
    const antes: EstadoCola = { ...estadoInicial({ [kB]: b.fecha }), fallos: 2 };
    const r = trasEnvio(antes, [a], falla('demasiadas_peticiones'), T0);
    expect(r.espera).toBe(ESPERA_DEMASIADAS_MS);
    expect(r.espera).toBe(60_000);
    expect(r.estado).toEqual(antes);
  });

  it('codigo_no_activo deja inactivo y no espera nada (sin reintento)', () => {
    const r = trasEnvio(estadoInicial(), [a], falla('codigo_no_activo'), T0);
    expect(r.estado.inactivo).toBe(true);
    expect(r.espera).toBeNull();
    expect(r.estado.fallos).toBe(0);
    expect(r.estado.confirmadas).toEqual({});
  });

  it('no muta el estado de entrada', () => {
    const antes = estadoInicial({ [kB]: b.fecha });
    const copia = structuredClone(antes);
    trasEnvio(antes, [a], recibe(a), T0);
    trasEnvio(antes, [a], falla('formato'), T0);
    expect(antes).toEqual(copia);
  });
});

describe('confirmación por clave y fecha (R3.3)', () => {
  it('la clave con la misma fecha confirma la respuesta y la saca de pendientes', () => {
    const r = trasEnvio(estadoInicial(), [a, b], recibe(a), T0);
    expect(r.estado.confirmadas).toEqual({ [kA]: a.fecha });
    expect(pendientes([a, b], r.estado.confirmadas)).toEqual([b]);
  });

  it('la misma clave con otra fecha no confirma', () => {
    const otra = { ...a, fecha: '2026-10-10T10:00:01.000Z' };
    const r = trasEnvio(estadoInicial(), [a], { ok: true, recibidas: new Set([claveConfirmacion(otra)]) }, T0);
    expect(r.estado.confirmadas).toEqual({});
    expect(pendientes([a], r.estado.confirmadas)).toEqual([a]);
  });

  it('sin la clave no confirma, suma un fallo y espera 2000', () => {
    const r = trasEnvio(estadoInicial(), [a], { ok: true, recibidas: new Set() }, T0);
    expect(r.estado.confirmadas).toEqual({});
    expect(r.estado.fallos).toBe(1);
    expect(r.espera).toBe(2000);
    expect(r.estado.ultimaConfirmacion).toBeNull();
  });

  it('confirma una parte del lote: suma un fallo, espera y marca la confirmación', () => {
    const r = trasEnvio(estadoInicial(), [a, b], recibe(a), T0);
    expect(r.estado.fallos).toBe(1);
    expect(r.espera).toBe(2000);
    expect(r.estado.ultimaConfirmacion).toBe(T0);
  });

  it('una clave que no está en el lote se ignora', () => {
    expect(confirmarRecibidas({}, [a], claves(b))).toEqual({});
    const r = trasEnvio(estadoInicial(), [a], recibe(b), T0);
    expect(r.estado.confirmadas).toEqual({});
    expect(r.estado.fallos).toBe(1);
  });

  it('confirmarRecibidas no muta la entrada', () => {
    const antes = { [kB]: b.fecha };
    const copia = structuredClone(antes);
    const nuevas = confirmarRecibidas(antes, [a], claves(a));
    expect(antes).toEqual(copia);
    expect(nuevas).toEqual({ [kB]: b.fecha, [kA]: a.fecha });
  });

  it('una respuesta confirmada y luego editada (fecha nueva) vuelve a pendientes y a porEnviar', () => {
    const e = trasEnvio(estadoInicial(), [a], recibe(a), T0).estado;
    expect(pendientes([a], e.confirmadas)).toEqual([]);
    const editada = { ...a, veredicto: 'no_es_mi_area' as const, fecha: '2026-10-10T12:00:00.000Z' };
    expect(pendientes([editada], e.confirmadas)).toEqual([editada]);
    expect(porEnviar([editada], e.confirmadas, e.rechazadas)).toEqual([editada]);
  });

  it('un "Corregir" sin propuesta no aparece en pendientes', () => {
    const vacia: Respuesta = { ...b, propuesta: undefined };
    expect(pendientes([vacia, a], {})).toEqual([a]);
  });
});

describe('armarLotes (D3)', () => {
  it('sin respuestas da []; con una da un lote de una', () => {
    expect(armarLotes(CODIGO, [])).toEqual([]);
    expect(armarLotes(CODIGO, [a])).toEqual([[a]]);
  });

  it('120 respuestas cortas dan lotes de 50, 50 y 20', () => {
    const l = Array.from({ length: 120 }, (_, i) => corta(i));
    expect(armarLotes(CODIGO, l).map((x) => x.length)).toEqual([50, 50, 20]);
    expect(MAX_LOTE_RESPUESTAS).toBe(50);
  });

  it('corta por bytes: cada lote cabe en 61440 y la primera del siguiente no cabía en el anterior', () => {
    const l = Array.from({ length: 60 }, (_, i) => larga(i, 3000));
    const lotes = armarLotes(CODIGO, l);
    expect(MAX_LOTE_BYTES).toBe(61_440);
    expect(lotes.length).toBeGreaterThan(1);
    expect(lotes.every((x) => bytes(x) <= MAX_LOTE_BYTES)).toBe(true);
    expect(lotes.every((x) => x.length < MAX_LOTE_RESPUESTAS)).toBe(true);
    for (let i = 0; i + 1 < lotes.length; i++) {
      const sig = lotes[i + 1]![0]!;
      expect(bytes([...lotes[i]!, sig])).toBeGreaterThan(MAX_LOTE_BYTES);
    }
    expect(lotes.flat()).toEqual(l);
  });

  describe('borde exacto de 61440 bytes del cuerpo POST', () => {
    // 15 respuestas válidas de 3900 caracteres (el tope de `respuestaValida` es 4000 por texto) y una
    // última con el relleno 'x' (1 byte cada una) que deja el cuerpo del lote en exactamente `objetivo` bytes.
    const loteDe = (objetivo: number): Respuesta[] => {
      const base = Array.from({ length: 15 }, (_, i) => larga(i, 3900));
      const vacia = larga(15, 0);
      const relleno = objetivo - bytes([...base, vacia]);
      expect(relleno).toBeGreaterThan(0);
      expect(relleno).toBeLessThanOrEqual(4000);
      const ultima = larga(15, relleno);
      expect(bytes([...base, ultima])).toBe(objetivo);
      return [...base, ultima];
    };

    it('un cuerpo de exactamente 61440 bytes cabe: sale en un solo lote', () => {
      const l = loteDe(MAX_LOTE_BYTES);
      expect(l.length).toBeLessThan(MAX_LOTE_RESPUESTAS);
      expect(armarLotes(CODIGO, l)).toEqual([l]);
    });

    it('un cuerpo de 61441 bytes no cabe: la última sale en un segundo lote', () => {
      const l = loteDe(MAX_LOTE_BYTES + 1);
      const lotes = armarLotes(CODIGO, l);
      expect(lotes.map((x) => x.length)).toEqual([15, 1]);
      expect(lotes.flat()).toEqual(l);
    });
  });

  it('cuenta bytes UTF-8, no caracteres', () => {
    // 'ñ' pesa 2 bytes: 20000 caracteres por respuesta son 40000 bytes, así que dos no caben juntas.
    const l = [larga(1, 0), larga(2, 0), larga(3, 0)].map((r) => ({ ...r, comentario: 'ñ'.repeat(20_000) }));
    const lotes = armarLotes(CODIGO, l);
    expect(lotes.map((x) => x.length)).toEqual([1, 1, 1]);
  });

  it('respeta el tope', () => {
    const l = Array.from({ length: 10 }, (_, i) => corta(i));
    expect(armarLotes(CODIGO, l, 3).map((x) => x.length)).toEqual([3, 3, 3, 1]);
  });

  it('una respuesta que sola pasa el tope de bytes sale en su propio lote y se conserva el orden', () => {
    const grande = larga(1, 70_000);
    const l = [corta(0), grande, corta(2)];
    const lotes = armarLotes(CODIGO, l);
    expect(lotes).toEqual([[l[0]], [grande], [l[2]]]);
    expect(bytes([grande])).toBeGreaterThan(MAX_LOTE_BYTES);
  });

  it('una respuesta enorme al principio sale sola, sin un lote vacío antes', () => {
    const grande = larga(1, 70_000);
    const lotes = armarLotes(CODIGO, [grande, corta(2)]);
    expect(lotes).toEqual([[grande], [corta(2)]]);
    expect(lotes.every((x) => x.length > 0)).toBe(true);
  });
});

describe('partición ante formato o demasiado_grande (D3)', () => {
  const lote = [corta(1), corta(2), corta(3), corta(4)];
  it.each(['formato', 'demasiado_grande'] as const)('%s: un lote de 4 deja tope 2 y espera 0', (error) => {
    const r = trasEnvio(estadoInicial(), lote, falla(error), T0);
    expect(r.estado.tope).toBe(2);
    expect(r.espera).toBe(0);
    expect(armarLotes(CODIGO, lote, r.estado.tope)[0]).toHaveLength(2);
    expect(r.estado.rechazadas).toEqual({});
    expect(r.estado.fallos).toBe(0);
  });

  it.each(['formato', 'demasiado_grande'] as const)('%s: un lote de 2 deja tope 1 y uno de 3 deja tope 2', (error) => {
    expect(trasEnvio(estadoInicial(), lote.slice(0, 2), falla(error), T0).estado.tope).toBe(1);
    expect(trasEnvio(estadoInicial(), lote.slice(0, 3), falla(error), T0).estado.tope).toBe(2);
  });

  it.each(['formato', 'demasiado_grande'] as const)('%s: una que falla sola queda rechazada, sin reintento, y vuelve si se edita', (error) => {
    const previo: EstadoCola = { ...estadoInicial(), tope: 1 };
    const r = trasEnvio(previo, [a], falla(error), T0);
    expect(r.espera).toBe(0);
    expect(r.estado.tope).toBe(50);
    expect(r.estado.rechazadas).toEqual({ [kA]: a.fecha });
    expect(porEnviar([a], r.estado.confirmadas, r.estado.rechazadas)).toEqual([]);
    expect(pendientes([a], r.estado.confirmadas)).toEqual([a]);
    const editada = { ...a, fecha: '2026-10-10T12:00:00.000Z' };
    expect(porEnviar([editada], r.estado.confirmadas, r.estado.rechazadas)).toEqual([editada]);
  });

  it('las demás pendientes siguen por enviar cuando una fue rechazada', () => {
    const r = trasEnvio(estadoInicial(), [a], falla('formato'), T0);
    expect(porEnviar([a, b], r.estado.confirmadas, r.estado.rechazadas)).toEqual([b]);
  });
});

describe('ofrecerRespaldo (D2)', () => {
  it.each([
    ['justo a los 10 min', T0, T0 + 600_000, true, true],
    ['un ms antes de los 10 min', T0, T0 + 599_999, true, false],
    ['sin pendientes', T0, T0 + 600_000, false, false],
    ['sin ventana abierta', null, T0 + 10 ** 9, true, false],
  ])('%s', (_n, ultima, ahora, hay, esperado) => {
    expect(ofrecerRespaldo(ultima, ahora, hay)).toBe(esperado);
    expect(AVISO_RESPALDO_MS).toBe(600_000);
  });

  it('escenario: pendientes desde t0 con red caída ofrecen a los 10 min; una confirmación a los 5 reinicia la ventana', () => {
    let e = marcarPendientes(estadoInicial(), true, T0);
    expect(e.ultimaConfirmacion).toBe(T0);
    for (let m = 1; m <= 10; m++) e = trasEnvio(e, [a], falla('red'), T0 + m * MIN).estado;
    expect(e.ultimaConfirmacion).toBe(T0);
    expect(ofrecerRespaldo(e.ultimaConfirmacion, T0 + 10 * MIN, true)).toBe(true);

    let f = marcarPendientes(estadoInicial(), true, T0);
    f = trasEnvio(f, [a, b], recibe(a), T0 + 5 * MIN).estado;
    f = marcarPendientes(f, true, T0 + 6 * MIN);
    expect(f.ultimaConfirmacion).toBe(T0 + 5 * MIN);
    expect(ofrecerRespaldo(f.ultimaConfirmacion, T0 + 10 * MIN, true)).toBe(false);
    expect(ofrecerRespaldo(f.ultimaConfirmacion, T0 + 15 * MIN, true)).toBe(true);
    expect(marcarPendientes(f, false, T0 + 16 * MIN).ultimaConfirmacion).toBeNull();
  });

  it('marcarPendientes no cambia la ventana abierta y abre una nueva solo con pendientes', () => {
    const abierta = marcarPendientes(estadoInicial(), true, T0);
    expect(marcarPendientes(abierta, true, T0 + 5).ultimaConfirmacion).toBe(T0);
    expect(marcarPendientes(estadoInicial(), false, T0).ultimaConfirmacion).toBeNull();
  });
});

describe('fusionarConCanal (R4.2)', () => {
  const nueva = { ...a, veredicto: 'corregir' as const, propuesta: 'Del canal', fecha: '2026-10-10T12:00:00.000Z' };
  const vieja = { ...a, veredicto: 'no_es_mi_area' as const, fecha: '2026-10-10T09:00:00.000Z' };

  it('el canal más nuevo reemplaza a la local, queda confirmado y no sale en porEnviar', () => {
    const r = fusionarConCanal({ [kA]: a }, {}, [nueva]);
    expect(r.respuestas[kA]).toBe(nueva);
    expect(r.confirmadas).toEqual({ [kA]: nueva.fecha });
    expect(porEnviar(Object.values(r.respuestas), r.confirmadas, {})).toEqual([]);
  });

  it('la local más nueva se conserva y sigue por enviar, sin confirmar la del canal', () => {
    const r = fusionarConCanal({ [kA]: a }, {}, [vieja]);
    expect(r.respuestas[kA]).toBe(a);
    expect(r.confirmadas).toEqual({});
    expect(porEnviar(Object.values(r.respuestas), r.confirmadas, {})).toEqual([a]);
  });

  it('con la misma fecha se conserva la referencia local y queda confirmada', () => {
    const igual = { ...a };
    const r = fusionarConCanal({ [kA]: a }, {}, [igual]);
    expect(r.respuestas[kA]).toBe(a);
    expect(r.confirmadas).toEqual({ [kA]: a.fecha });
  });

  it('una clave solo del canal se agrega y queda confirmada', () => {
    const r = fusionarConCanal({ [kA]: a }, {}, [b]);
    expect(r.respuestas[kB]).toBe(b);
    expect(r.respuestas[kA]).toBe(a);
    expect(r.confirmadas).toEqual({ [kB]: b.fecha });
  });

  it('no muta locales ni confirmadas', () => {
    const locales = { [kA]: a };
    const confirmadas = { [kB]: b.fecha };
    const l0 = structuredClone(locales);
    const c0 = structuredClone(confirmadas);
    const r = fusionarConCanal(locales, confirmadas, [nueva, b]);
    expect(locales).toEqual(l0);
    expect(confirmadas).toEqual(c0);
    expect(r.confirmadas).not.toBe(confirmadas);
    expect(r.respuestas).not.toBe(locales);
  });
});
