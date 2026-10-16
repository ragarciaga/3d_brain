import { beforeEach, describe, expect, it } from 'vitest';
import { cortesApagados, piezasEncefalo, rangoCerebro, type Cortes, type Rango } from '../src/lib/cortes';
import {
  aplicarCortesEnlace,
  entradasDeCortes,
  leer,
  serializar,
  validarCortes,
  type EntradaCorte,
} from '../src/lib/enlaces';
import type { Vec3 } from '../src/lib/explosion';
import type { Caja } from '../src/lib/inventario';
import { objetivo, useAtlas } from '../src/store/useAtlas';

describe('enlaces compartibles (F11)', () => {
  it('ida y vuelta del estado de la vista', () => {
    const e = { vista: 'lateral-izq' as const, aislar: 'contexto' as const, explosion: 40, nivel: 'lobulos' as const };
    expect(leer(serializar(e))).toEqual(e);
  });

  it('ignora valores inválidos', () => {
    expect(leer('?vista=arriba&aislar=x&explosion=abc&cam=1,2')).toEqual({});
  });

  it('conserva la cámara con precisión de 0,1 mm', () => {
    const cam = [0.1, 1.6, 0.4, 0, 1.55, 0];
    expect(leer(serializar({ camara: cam })).camara).toEqual(cam);
  });

  it('sin corte el enlace sale y se lee igual que antes (preservar)', () => {
    expect(serializar({ vista: 'lateral-izq', aislar: 'contexto', explosion: 40, nivel: 'lobulos' })).toBe(
      '?vista=lateral-izq&aislar=contexto&explosion=40&nivel=lobulos',
    );
    expect('corte' in leer('?vista=anterior&explosion=40')).toBe(false);
  });
});

const coronal12: EntradaCorte = { plano: 'coronal', mm: 12, invertido: false };
const axial8inv: EntradaCorte = { plano: 'axial', mm: -8, invertido: true };

describe('corte= al serializar (R7.1)', () => {
  it('emite plano:mm y :inv, separados por comas, con el literal del ejemplo', () => {
    expect(serializar({ corte: [axial8inv, coronal12] })).toBe('?corte=coronal:12,axial:-8:inv');
  });

  it('sale en el orden sagital, coronal, axial aunque lleguen al revés', () => {
    const e: EntradaCorte[] = [
      { plano: 'axial', mm: 3, invertido: false },
      { plano: 'coronal', mm: -4, invertido: true },
      { plano: 'sagital', mm: 5, invertido: false },
    ];
    expect(serializar({ corte: e })).toBe('?corte=sagital:5,coronal:-4:inv,axial:3');
  });

  it('va al final, tras los demás parámetros, sin codificar : ni ,', () => {
    const s = serializar({ vista: 'anterior', corte: [coronal12, axial8inv] });
    expect(s).toBe('?vista=anterior&corte=coronal:12,axial:-8:inv');
    expect(s).not.toContain('%3A');
    expect(s).not.toContain('%2C');
  });

  it('un corte vacío no emite corte', () => {
    expect(serializar({ corte: [] })).toBe('');
    expect(serializar({ vista: 'anterior', corte: [] })).toBe('?vista=anterior');
  });

  it('redondea los mm a enteros', () => {
    expect(serializar({ corte: [{ plano: 'axial', mm: 3.6, invertido: false }] })).toBe('?corte=axial:4');
    expect(serializar({ corte: [{ plano: 'axial', mm: -0, invertido: false }] })).toBe('?corte=axial:0');
  });

  it('ida y vuelta con corte, vista y explosión', () => {
    const e = {
      vista: 'superior' as const,
      explosion: 25,
      corte: [
        { plano: 'sagital' as const, mm: -5, invertido: false },
        coronal12,
        axial8inv,
      ],
    };
    expect(leer(serializar(e))).toEqual(e);
  });
});

describe('entradasDeCortes (R7.1)', () => {
  it('con los planos apagados no hay entradas', () => {
    expect(entradasDeCortes(cortesApagados())).toEqual([]);
  });

  it('solo incluye los planos activos, aunque el inactivo traiga mm e invertido', () => {
    const c: Cortes = {
      sagital: { activo: false, mm: 20, invertido: true },
      coronal: { activo: true, mm: 12, invertido: false },
      axial: { activo: true, mm: -8, invertido: true },
    };
    expect(entradasDeCortes(c)).toEqual([coronal12, axial8inv]);
  });

  it('los tres activos salen en el orden de PLANOS', () => {
    const c: Cortes = {
      sagital: { activo: true, mm: 1, invertido: false },
      coronal: { activo: true, mm: 2, invertido: false },
      axial: { activo: true, mm: 3, invertido: false },
    };
    expect(entradasDeCortes(c).map((e) => e.plano)).toEqual(['sagital', 'coronal', 'axial']);
  });
});

describe('corte= al leer (R7.3)', () => {
  it('lee las entradas en el orden de la URL', () => {
    expect(leer('?corte=coronal:12,axial:-8:inv').corte).toEqual([coronal12, axial8inv]);
  });

  it('lee la forma con : y , codificados', () => {
    expect(leer('?corte=coronal%3A12%2Caxial%3A-8%3Ainv').corte).toEqual([coronal12, axial8inv]);
  });

  it.each([
    ['plano desconocido', 'oblicuo:5'],
    ['mm no numérico', 'axial:abc'],
    ['sufijo desconocido', 'axial:3:x'],
    ['5 dígitos', 'axial:12345'],
    ['signo más', 'axial:+3'],
    ['mm vacío', 'axial:'],
    ['decimal', 'axial:3.5'],
    ['entrada vacía', ''],
  ])('ignora solo la entrada mal escrita (%s) y conserva coronal:12', (_n, mala) => {
    expect(leer(`?corte=${mala},coronal:12`).corte).toEqual([coronal12]);
    expect(leer(`?corte=coronal:12,${mala}`).corte).toEqual([coronal12]);
  });

  it('una entrada vacía entre comas no afecta a las demás', () => {
    expect(leer('?corte=coronal:12,,axial:4').corte).toEqual([coronal12, { plano: 'axial', mm: 4, invertido: false }]);
  });

  it('la repetida se ignora: gana la primera', () => {
    expect(leer('?corte=coronal:12,coronal:30,axial:4').corte).toEqual([
      coronal12,
      { plano: 'axial', mm: 4, invertido: false },
    ]);
  });

  it('una mal escrita antes de una válida del mismo plano no consume el plano', () => {
    expect(leer('?corte=coronal:x,coronal:30').corte).toEqual([{ plano: 'coronal', mm: 30, invertido: false }]);
  });

  it('axial:-0 se lee como 0, nunca -0', () => {
    const mm = leer('?corte=axial:-0').corte![0]!.mm;
    expect(Object.is(mm, 0)).toBe(true);
  });

  it('sin entradas válidas la clave corte no existe', () => {
    expect('corte' in leer('?corte=')).toBe(false);
    expect('corte' in leer('?corte=x')).toBe(false);
    expect('corte' in leer('')).toBe(false);
  });
});

describe('validarCortes (R7.3)', () => {
  const rango: Rango = {
    centro: [0, 0, 0] as Vec3,
    min: { sagital: -60, coronal: -60, axial: -60 },
    max: { sagital: 60, coronal: 60, axial: 60 },
  };
  const dentro: EntradaCorte = { plano: 'axial', mm: 5, invertido: false };

  it('conserva los bordes: max y min son inclusivos', () => {
    const borde: EntradaCorte[] = [
      { plano: 'sagital', mm: 60, invertido: false },
      { plano: 'coronal', mm: -60, invertido: true },
    ];
    expect(validarCortes(borde, rango)).toEqual(borde);
  });

  it('descarta max + 1 sin ajustarlo y deja las demás', () => {
    expect(validarCortes([{ plano: 'sagital', mm: 61, invertido: false }, dentro], rango)).toEqual([dentro]);
  });

  it('descarta min - 1 sin ajustarlo y deja las demás', () => {
    expect(validarCortes([{ plano: 'coronal', mm: -61, invertido: false }, dentro], rango)).toEqual([dentro]);
  });

  it('descarta un mm no entero', () => {
    expect(validarCortes([{ plano: 'axial', mm: 2.5, invertido: false }, dentro], rango)).toEqual([dentro]);
  });
});

describe('aplicarCortesEnlace con el store real (R7.4, R7.3, D1)', () => {
  const nombres = ['hippocampus-l', 'hippocampus-r', 'thalamus-l', 'thalamus-r', 'precentral-gyrus-l', 'postcentral-gyrus-l'];
  const centros = Object.fromEntries(
    nombres.map((p, i) => [p, [(i % 2 ? -1 : 1) * 0.02 * (i + 1), 1.6 + i * 0.01, 0.01 * i] as Vec3]),
  );
  const cajas: Record<string, Caja> = Object.fromEntries(
    Object.entries(centros).map(([p, c]) => [
      p,
      [
        [c[0] - 0.02, c[1] - 0.03, c[2] - 0.04],
        [c[0] + 0.02, c[1] + 0.03, c[2] + 0.04],
      ] as Caja,
    ]),
  );
  const rango = rangoCerebro(cajas, piezasEncefalo);
  const entradas: EntradaCorte[] = [coronal12, axial8inv];

  const instantanea = () => {
    const s = useAtlas.getState();
    return {
      cortes: s.cortes,
      explosion: s.explosion,
      separadas: s.separadas,
      devueltas: [...s.devueltas],
      inventario: s.inventario,
      base: s.base,
    };
  };

  beforeEach(() => {
    useAtlas.setState({
      cortes: cortesApagados(),
      explosion: 0,
      separadas: {},
      devueltas: new Set(),
      ocultas: new Set(),
      aislar: null,
      grupoActivo: null,
      nivel: 'piezas',
    });
    useAtlas.getState().setCentros(centros, cajas);
  });

  it('el fixture alcanza para 12 mm coronal y -8 mm axial', () => {
    expect(rango.max.coronal).toBeGreaterThanOrEqual(12);
    expect(rango.min.axial).toBeLessThanOrEqual(-8);
  });

  it('R7.4: con explosión y una pieza separada, aplicar arma el cerebro y deja los planos en su sitio', () => {
    useAtlas.getState().setExplosion(0.4);
    useAtlas.getState().separar(['thalamus-l']);
    const previo = useAtlas.getState();
    expect(previo.explosion).toBe(0.4);
    expect(Object.keys(previo.separadas)).toContain('thalamus-l');
    expect(Object.values(previo.base).some((b) => b.some((v) => v !== 0))).toBe(true);

    expect(aplicarCortesEnlace(entradas)).toEqual(entradas);

    const s = useAtlas.getState();
    expect(s.explosion).toBe(0);
    expect(s.separadas).toEqual({});
    expect(s.devueltas.size).toBe(0);
    expect(s.inventario).toBe(false);
    expect(s.cortes.coronal).toEqual({ activo: true, mm: 12, invertido: false });
    expect(s.cortes.axial).toEqual({ activo: true, mm: -8, invertido: true });
    expect(s.cortes.sagital).toEqual({ activo: false, mm: 0, invertido: false });
    for (const p of nombres) expect(objetivo(s, p)).toEqual([0, 0, 0]);
  });

  it('R7.4: aplicarla dos veces deja el mismo estado', () => {
    useAtlas.getState().setExplosion(0.4);
    useAtlas.getState().separar(['thalamus-l']);
    aplicarCortesEnlace(entradas);
    const una = instantanea();
    aplicarCortesEnlace(entradas);
    expect(instantanea()).toEqual(una);
  });

  it('R7.3: la de fuera de rango no se aplica ni se ajusta al borde, y la válida sí', () => {
    const fuera: EntradaCorte = { plano: 'sagital', mm: rango.max.sagital + 1, invertido: false };
    const buena: EntradaCorte = { plano: 'coronal', mm: 5, invertido: false };
    expect(aplicarCortesEnlace([fuera, buena])).toEqual([buena]);
    const s = useAtlas.getState();
    expect(s.cortes.sagital).toEqual({ activo: false, mm: 0, invertido: false });
    expect(s.cortes.coronal).toEqual({ activo: true, mm: 5, invertido: false });
  });

  it('D1: sin el modelo cargado no cambia los cortes y devuelve []', () => {
    useAtlas.setState({ cargado: false });
    expect(aplicarCortesEnlace(entradas)).toEqual([]);
    expect(useAtlas.getState().cortes).toEqual(cortesApagados());
  });
});

describe('alias de URL por sinónimo (F11)', () => {
  it('/es/amigdala y /es/insula resuelven, como en el ejemplo del SPEC', async () => {
    const { entradaPorSlug } = await import('../src/data/atlas');
    expect(entradaPorSlug('amigdala', 'es')).toBe('amygdaloid-body');
    expect(entradaPorSlug('insula', 'es')).toBe('g-insula');
    expect(entradaPorSlug('amygdala', 'en')).toBe('amygdaloid-body');
  });
});
