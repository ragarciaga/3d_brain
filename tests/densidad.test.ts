import { describe, expect, it } from 'vitest';
import {
  DENSIDAD_INICIAL,
  dprEfectivo,
  leerDprFijo,
  MAX_SUBIDAS,
  siguienteDensidad,
  topeDpr,
  type EstadoDensidad,
} from '../src/lib/densidad';

/** Aplica una serie de muestras de cuadros por segundo, una tras otra. */
function aplicar(estado: EstadoDensidad, muestras: number[], valida = true): EstadoDensidad {
  return muestras.reduce((e, fps) => siguienteDensidad(e, fps, valida), estado);
}
const repetir = (fps: number, n: number) => Array.from({ length: n }, () => fps);
/** Estado en el nivel 1 (tope 1,5) tras una racha lenta. */
const nivel1 = () => aplicar(DENSIDAD_INICIAL, repetir(22, 6));

describe('leerDprFijo', () => {
  it.each([
    ['?dpr=1', 1],
    ['?dpr=1.5', 1.5],
    ['?dpr=0.5', 0.5],
    ['?dpr=3', 3],
    ['?medir=1&dpr=1.5', 1.5],
  ])('%s da %s', (search, esperado) => {
    expect(leerDprFijo(search)).toBe(esperado);
  });

  it.each(['', '?dpr=', '?dpr=abc', '?dpr=1,5', '?dpr=Infinity', '?dpr=0', '?dpr=-1', '?dpr=0.4', '?dpr=3.5', '?medir=1'])(
    '%j no fija la densidad',
    (search) => {
      expect(leerDprFijo(search)).toBeNull();
    },
  );
});

describe('siguienteDensidad: bajar', () => {
  it('el estado inicial es el tope de hoy, [1, 2]', () => {
    expect(topeDpr(DENSIDAD_INICIAL)).toBe(2);
  });

  it('con 5 muestras lentas no baja; la sexta baja de 2 a 1,5', () => {
    const e5 = aplicar(DENSIDAD_INICIAL, repetir(22, 5));
    expect(topeDpr(e5)).toBe(2);
    expect(topeDpr(siguienteDensidad(e5, 22, true))).toBe(1.5);
  });

  it('otras 6 lentas bajan de 1,5 a 1, y en el piso otra racha no lo cambia', () => {
    const e = aplicar(DENSIDAD_INICIAL, repetir(22, 12));
    expect(topeDpr(e)).toBe(1);
    expect(e.nivel).toBe(2);
    const piso = aplicar(e, repetir(22, 6));
    expect(topeDpr(piso)).toBe(1);
    expect(piso.nivel).toBe(2);
    expect(piso.bajas).toBe(0);
  });

  it('una muestra holgada interrumpe la racha lenta', () => {
    const e = aplicar(DENSIDAD_INICIAL, [...repetir(22, 5), 60, 22]);
    expect(e.bajas).toBe(1);
    expect(topeDpr(e)).toBe(2);
  });

  it('una muestra lenta interrumpe la racha holgada', () => {
    const e = aplicar(nivel1(), [...repetir(60, 10), 22, ...repetir(60, 10)]);
    expect(e.altas).toBe(10);
    expect(topeDpr(e)).toBe(1.5);
  });

  it('30 exacto no es lento: reinicia la racha', () => {
    const e = aplicar(DENSIDAD_INICIAL, [...repetir(22, 5), 30, ...repetir(22, 5)]);
    expect(topeDpr(e)).toBe(2);
  });

  it('una muestra no válida reinicia la racha', () => {
    const e = aplicar(aplicar(DENSIDAD_INICIAL, repetir(22, 5)), [22], false);
    expect(e.bajas).toBe(0);
    expect(topeDpr(aplicar(e, repetir(22, 5)))).toBe(2);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['negativo', -1],
  ])('fps %s reinicia la racha', (_nombre, fps) => {
    const e = aplicar(DENSIDAD_INICIAL, [...repetir(22, 5), fps, ...repetir(22, 5)]);
    expect(topeDpr(e)).toBe(2);
  });

  it('una lectura de 0 cuadros/s cuenta como lenta: 6 seguidas bajan un nivel', () => {
    const e5 = aplicar(DENSIDAD_INICIAL, repetir(0, 5));
    expect(e5.bajas).toBe(5);
    expect(topeDpr(e5)).toBe(2);
    expect(topeDpr(siguienteDensidad(e5, 0, true))).toBe(1.5);
  });

  it('un 0 entre lecturas lentas mantiene la racha', () => {
    const e = aplicar(DENSIDAD_INICIAL, [...repetir(22, 3), 0, 22]);
    expect(e.bajas).toBe(5);
    expect(topeDpr(aplicar(e, [22]))).toBe(1.5);
  });

  it('la serie 1, 1, 0 repetida baja el tope', () => {
    const e = aplicar(DENSIDAD_INICIAL, [1, 1, 0, 1, 1, 0]);
    expect(topeDpr(e)).toBe(1.5);
  });

  it('un 0 interrumpe la racha holgada', () => {
    const e = aplicar(nivel1(), [...repetir(60, 19), 0, 60]);
    expect(e.altas).toBe(1);
    expect(topeDpr(e)).toBe(1.5);
  });

  it('un 0 no válido (pestaña oculta o sin modelo) sigue reiniciando', () => {
    const e = aplicar(aplicar(DENSIDAD_INICIAL, repetir(22, 5)), [0], false);
    expect(e.bajas).toBe(0);
  });
});

describe('siguienteDensidad: subir', () => {
  it('con 19 muestras holgadas no sube; la vigésima sube a tope 2', () => {
    const e19 = aplicar(nivel1(), repetir(60, 19));
    expect(topeDpr(e19)).toBe(1.5);
    expect(topeDpr(siguienteDensidad(e19, 60, true))).toBe(2);
  });

  it('fps infinito no cuenta como holgado: reinicia la racha', () => {
    const e = aplicar(nivel1(), [...repetir(60, 19), Infinity, 60]);
    expect(topeDpr(e)).toBe(1.5);
    expect(e.altas).toBe(1);
  });

  it('55 exacto cuenta como holgado', () => {
    expect(topeDpr(aplicar(nivel1(), repetir(55, 20)))).toBe(2);
  });

  it('una muestra de 54 interrumpe la racha', () => {
    const e = aplicar(nivel1(), [...repetir(60, 19), 54, ...repetir(60, 19)]);
    expect(topeDpr(e)).toBe(1.5);
  });

  it('una muestra entre los umbrales (40) reinicia los dos contadores', () => {
    const e = aplicar(DENSIDAD_INICIAL, [...repetir(22, 5), ...repetir(60, 10), 40]);
    expect(e.bajas).toBe(0);
    expect(e.altas).toBe(0);
    const e2 = aplicar(DENSIDAD_INICIAL, [...repetir(22, 5), 40]);
    expect(e2.bajas).toBe(0);
    const e3 = aplicar(nivel1(), [...repetir(60, 10), 40]);
    expect(e3.altas).toBe(0);
  });

  it('sube como máximo MAX_SUBIDAS veces y después solo puede bajar', () => {
    let e = aplicar(DENSIDAD_INICIAL, repetir(22, 12)); // nivel 2
    e = aplicar(e, repetir(60, 20)); // sube (1)
    expect(e.nivel).toBe(1);
    e = aplicar(e, repetir(22, 6)); // baja
    expect(e.nivel).toBe(2);
    e = aplicar(e, repetir(60, 20)); // sube (2)
    expect(e.nivel).toBe(1);
    expect(e.subidas).toBe(MAX_SUBIDAS);
    e = aplicar(e, repetir(22, 6)); // baja
    expect(e.nivel).toBe(2);
    e = aplicar(e, repetir(60, 40)); // ya no sube
    expect(e.nivel).toBe(2);
    expect(e.subidas).toBe(MAX_SUBIDAS);
    e = aplicar(e, repetir(60, 40));
    expect(e.nivel).toBe(2);
  });

  it('un equipo que va a 60 no cambia la densidad', () => {
    const e = aplicar(DENSIDAD_INICIAL, Array.from({ length: 200 }, (_, i) => 56 + ((i * 2) % 5)));
    expect(e.nivel).toBe(0);
    expect(e.subidas).toBe(0);
    expect(topeDpr(e)).toBe(2);
  });
});

describe('siguienteDensidad: pureza y contadores', () => {
  it('no muta el estado de entrada', () => {
    const e = Object.freeze({ nivel: 1, bajas: 3, altas: 0, subidas: 1 });
    const copia = { ...e };
    siguienteDensidad(e, 22, true);
    siguienteDensidad(e, 60, true);
    siguienteDensidad(e, 40, false);
    expect(e).toEqual(copia);
    expect(DENSIDAD_INICIAL).toEqual({ nivel: 0, bajas: 0, altas: 0, subidas: 0 });
  });

  it('después de cada cambio de nivel, los contadores valen 0', () => {
    let e = DENSIDAD_INICIAL;
    const secuencia = [...repetir(22, 12), ...repetir(60, 20), ...repetir(22, 6)];
    let cambios = 0;
    for (const fps of secuencia) {
      const sig = siguienteDensidad(e, fps, true);
      if (sig.nivel !== e.nivel) {
        cambios += 1;
        expect(sig.bajas).toBe(0);
        expect(sig.altas).toBe(0);
      }
      e = sig;
    }
    expect(cambios).toBe(4);
  });
});

describe('dprEfectivo', () => {
  it.each<[number | [number, number], number | undefined, number]>([
    [[1, 2], 1, 1],
    [[1, 2], 3, 2],
    [[1, 1.5], 2, 1.5],
    [[1, 2], 0.5, 1],
    [[1, 2], undefined, 2],
    [1.5, 1, 1.5],
  ])('dpr %j con pantalla %s da %s', (dpr, pantalla, esperado) => {
    expect(dprEfectivo(dpr, pantalla)).toBe(esperado);
  });
});
