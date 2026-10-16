import { describe, expect, it } from 'vitest';
import {
  acumularFluidez,
  cargaLenta,
  cuelloDeBotella,
  informe,
  MARCA_INDICE_INICIO,
  MARCA_INDICE_TOQUE,
  MARCA_INICIO_APP,
  MARCA_MODELO_LEIDO,
  MARCA_MODELO_LISTO,
  MARCA_PRIMER_CUADRO,
  muestraEnVentana,
  resumirCarga,
  resumirFluidez,
  seguirLeyendo,
  type DatosCarga,
  type Equipo,
  type EstadoFluidez,
  type Recurso,
} from '../src/lib/medicion';

const recurso = (
  name: string,
  startTime: number,
  responseEnd: number,
  transferSize: number,
  decodedBodySize = transferSize,
  encodedBodySize = transferSize,
): Recurso => ({
  name,
  startTime,
  responseEnd,
  transferSize,
  decodedBodySize,
  encodedBodySize,
});

const datos = {
  recursos: [
    recurso('https://brain.maysasp.com/assets/index-abc.js', 50, 900, 680_000, 2_560_000),
    recurso('https://brain.maysasp.com/assets/index-abc.css', 50, 120, 4_400),
    recurso('https://brain.maysasp.com/modelos/atlas.glb', 1_000, 4_000, 6_845_332),
  ],
  marcas: {
    [MARCA_INICIO_APP]: 950,
    [MARCA_MODELO_LEIDO]: 4_300,
    [MARCA_MODELO_LISTO]: 4_600,
    [MARCA_PRIMER_CUADRO]: 4_700,
    [MARCA_INDICE_INICIO]: 4_750,
    [MARCA_INDICE_TOQUE]: 5_000,
  } as Partial<Record<string, number>>,
};

const equipo: Equipo = { navegador: 'Chrome', pantalla: '1920 x 1080 @1x', nucleos: 4, memoriaGB: 8, gpu: 'Intel', densidad: null };

describe('medición de carga (issue 6)', () => {
  it('separa código, descarga del modelo y preparación del modelo', () => {
    const r = resumirCarga(datos);
    expect(r.codigoListoMs).toBe(950); // la app arrancó, no solo terminó la descarga
    expect(r.codigoKB).toBe(664);
    expect(r.modeloInicioMs).toBe(1_000);
    expect(r.modeloDescargaMs).toBe(3_000);
    expect(r.modeloKB).toBe(6_685);
    expect(r.modeloDesdeCache).toBe(false);
    expect(r.procesamientoMs).toBe(600);
    expect(r.primerCuadroMs).toBe(4_700);
    expect(cuelloDeBotella(r)).toBe('modelo');
  });

  it('reconoce el modelo que vino de la memoria del navegador', () => {
    const r = resumirCarga({ ...datos, recursos: [recurso('/modelos/atlas.glb', 100, 130, 0, 6_845_332)] });
    expect(r.modeloDesdeCache).toBe(true);
    expect(r.modeloKB).toBe(6_685);
  });

  it('sin la marca de inicio, el código cuenta hasta que llegó el último script', () => {
    const r = resumirCarga({ recursos: datos.recursos, marcas: {} });
    expect(r.codigoListoMs).toBe(900);
  });

  it('en desarrollo los módulos sueltos también cuentan como código', () => {
    const r = resumirCarga({ recursos: [recurso('http://localhost:3000/src/main.tsx', 10, 80, 2_048)], marcas: {} });
    expect(r.codigoKB).toBe(2);
  });

  it('sin el modelo todavía, no hay diagnóstico', () => {
    const r = resumirCarga({ recursos: [datos.recursos[0]!], marcas: {} });
    expect(r.modeloDescargaMs).toBeNull();
    expect(r.procesamientoMs).toBeNull();
    expect(cuelloDeBotella(r)).toBeNull();
  });

  it('la fluidez ignora muestras vacías y da promedio y mínimo', () => {
    expect(resumirFluidez([])).toBeNull();
    expect(resumirFluidez([0, 30, 60, 45])).toEqual({ promedio: 45, minimo: 30, muestras: 3 });
  });

  it('modelo pedido con el HTML que llega antes que el código', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 20, 2_500, 6_845_332)],
      marcas: { [MARCA_INICIO_APP]: 3_000, [MARCA_MODELO_LISTO]: 3_600 },
    });
    expect(r.modeloInicioMs).toBe(20);
    expect(r.modeloDescargaMs).toBe(2_480);
    expect(r.modeloEsperaMs).toBe(0);
    expect(r.procesamientoMs).toBe(600); // desde que el código estuvo listo, no desde el último byte
    expect(cuelloDeBotella(r)).toBe('codigo');
  });

  it('el cuello compara la espera por el modelo, no su descarga completa', () => {
    // Descarga larga (2500 ms) pero casi toda dentro de la espera por el código: solo se esperó 500 ms.
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 0, 2_500, 6_845_332)],
      marcas: { [MARCA_INICIO_APP]: 2_000, [MARCA_MODELO_LISTO]: 2_600 },
    });
    expect(r.modeloDescargaMs).toBe(2_500);
    expect(r.modeloEsperaMs).toBe(500);
    expect(r.procesamientoMs).toBe(100);
    expect(cuelloDeBotella(r)).toBe('codigo');
  });

  it('modelo pedido temprano que termina después del código', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 20, 4_000, 6_845_332)],
      marcas: { [MARCA_INICIO_APP]: 1_000, [MARCA_MODELO_LISTO]: 4_600 },
    });
    expect(r.modeloEsperaMs).toBe(3_000);
    expect(r.procesamientoMs).toBe(600);
    expect(cuelloDeBotella(r)).toBe('modelo');
  });

  it('sin dato del código, la preparación cuenta desde el último byte y no hay diagnóstico', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 100, 900, 6_845_332)],
      marcas: { [MARCA_MODELO_LISTO]: 1_500 },
    });
    expect(r.procesamientoMs).toBe(600);
    expect(r.modeloEsperaMs).toBeNull();
    expect(cuelloDeBotella(r)).toBeNull();
  });

  it('una entrada fallida antes de la buena no cuenta', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 10, 15, 0, 0), recurso('/modelos/atlas.glb', 2_000, 5_000, 6_845_332)],
      marcas: {},
    });
    expect(r.modeloInicioMs).toBe(2_000);
    expect(r.modeloDescargaMs).toBe(3_000);
  });

  it('con dos entradas con cuerpo, cuenta la primera (la precarga)', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 20, 2_500, 6_845_332), recurso('/modelos/atlas.glb', 3_000, 3_010, 0, 6_845_332)],
      marcas: {},
    });
    expect(r.modeloInicioMs).toBe(20);
    expect(r.modeloDescargaMs).toBe(2_480);
    expect(r.modeloDesdeCache).toBe(false);
  });

  it('sin ninguna entrada con cuerpo, usa la última', () => {
    const r = resumirCarga({
      recursos: [recurso('/modelos/atlas.glb', 10, 15, 0, 0), recurso('/modelos/atlas.glb', 40, 50, 0, 0)],
      marcas: {},
    });
    expect(r.modeloInicioMs).toBe(40);
  });

  it('el informe trae la espera después del código', () => {
    const txt = informe(
      resumirCarga(datos),
      { navegador: 'Chrome', pantalla: '1920 x 1080 @1x', nucleos: 4, memoriaGB: 8, gpu: 'Intel', densidad: null },
      null,
      '2026-10-14',
    );
    expect(txt).toContain('Modelo 3D: empezó a los 1000 ms, descarga 3000 ms (6685 KB)');
    expect(txt).toContain('espera después del código 3050 ms');
  });

  it('el informe trae equipo, tiempos y lo más lento', () => {
    const txt = informe(
      resumirCarga(datos),
      { navegador: 'Safari 18 (iPad)', pantalla: '1180 x 820 @2x', nucleos: 6, memoriaGB: null, gpu: 'Apple GPU', densidad: null },
      { promedio: 58, minimo: 41, muestras: 20 },
      '2026-10-12',
    );
    expect(txt).toContain('GPU: Apple GPU');
    expect(txt).toContain('Memoria: sin dato');
    expect(txt).toContain('descarga 3000 ms (6685 KB)');
    expect(txt).toContain('promedio 58, mínimo 41');
    expect(txt).toContain('Lo más lento: la descarga del modelo 3D');
  });

  describe('desglose de "Preparar el modelo" (issues 85 y 178)', () => {
    const sinNuevas = (): DatosCarga => ({
      recursos: datos.recursos,
      marcas: { [MARCA_INICIO_APP]: 950, [MARCA_MODELO_LISTO]: 4_600, [MARCA_PRIMER_CUADRO]: 4_700 },
    });

    it('leer y armar suman la preparación; el índice de toque va aparte, después del primer cuadro', () => {
      const r = resumirCarga(datos);
      expect(r.leerModeloMs).toBe(300);
      expect(r.armarPiezasMs).toBe(300);
      expect(r.leerModeloMs! + r.armarPiezasMs!).toBe(r.procesamientoMs);
      expect(r.procesamientoMs).toBe(600);
      expect(r.indiceToqueMs).toBe(250);
      expect(r.indiceInicioMs).toBe(4_750);
      expect(r.indiceListoMs).toBe(5_000);
    });

    it('con el modelo antes que el código, leer cuenta desde el código listo y no desde el último byte', () => {
      const r = resumirCarga({
        recursos: [recurso('/modelos/atlas.glb', 20, 2_500, 6_845_332)],
        marcas: {
          [MARCA_INICIO_APP]: 3_000,
          [MARCA_MODELO_LEIDO]: 3_300,
          [MARCA_MODELO_LISTO]: 3_600,
          [MARCA_INDICE_INICIO]: 3_700,
          [MARCA_INDICE_TOQUE]: 3_950,
        },
      });
      expect(r.leerModeloMs).toBe(300);
      expect(r.armarPiezasMs).toBe(300);
      expect(r.indiceToqueMs).toBe(250);
    });

    it('sin las marcas nuevas, leer, armar y el índice quedan sin dato y la preparación sigue', () => {
      const r = resumirCarga(sinNuevas());
      expect(r.leerModeloMs).toBeNull();
      expect(r.armarPiezasMs).toBeNull();
      expect(r.indiceToqueMs).toBeNull();
      expect(r.indiceInicioMs).toBeNull();
      expect(r.indiceListoMs).toBeNull();
      expect(r.procesamientoMs).toBe(600);
    });

    it('con solo la marca de leído, armar tiene dato y el índice no', () => {
      const r = resumirCarga({ recursos: datos.recursos, marcas: { ...sinNuevas().marcas, [MARCA_MODELO_LEIDO]: 4_300 } });
      expect(r.leerModeloMs).toBe(300);
      expect(r.armarPiezasMs).toBe(300);
      expect(r.indiceToqueMs).toBeNull();
    });

    it('con solo la marca de inicio del índice, la duración y la hora de listo quedan sin dato', () => {
      const r = resumirCarga({ recursos: datos.recursos, marcas: { ...sinNuevas().marcas, [MARCA_INDICE_INICIO]: 4_750 } });
      expect(r.indiceInicioMs).toBe(4_750);
      expect(r.indiceToqueMs).toBeNull();
      expect(r.indiceListoMs).toBeNull();
    });

    it('el informe trae la preparación con sus dos partes y el índice aparte', () => {
      const txt = informe(resumirCarga(datos), equipo, null, '2026-10-15');
      expect(txt).toContain('Preparar el modelo: 600 ms');
      expect(txt).toContain('  Leer el modelo (parseo y decodificación): 300 ms');
      expect(txt).toContain('  Armar las piezas y sus cajas: 300 ms');
      expect(txt).toContain('\nÍndice de toque (árboles BVH): 250 ms (empezó a los 4750 ms, listo a los 5000 ms)');
      expect(txt).not.toContain('  Índice de toque');
    });

    it('el informe dice sin dato cuando faltan las marcas nuevas', () => {
      const txt = informe(resumirCarga(sinNuevas()), equipo, null, '2026-10-15');
      expect(txt).toContain('Leer el modelo (parseo y decodificación): sin dato');
      expect(txt).toContain('Índice de toque (árboles BVH): sin dato');
      expect(txt).toContain('Armar las piezas y sus cajas: sin dato');
    });
  });

  describe('seguir leyendo las marcas (issue 178)', () => {
    it('sin primer cuadro sigue', () => {
      expect(seguirLeyendo(60_000, null, 5_000)).toBe(true);
    });

    it('dentro de la ventana de fluidez sigue, aunque el índice ya esté listo', () => {
      expect(seguirLeyendo(14_000, 5_000, 6_000)).toBe(true);
    });

    it('pasada la ventana sigue mientras el índice no esté listo', () => {
      expect(seguirLeyendo(20_000, 5_000, null)).toBe(true);
    });

    it('pasada la ventana y con el índice listo, para', () => {
      expect(seguirLeyendo(20_000, 5_000, 6_000)).toBe(false);
    });
  });

  describe('ventana de la fluidez (issue 85)', () => {
    const pc = 5_000;

    it('descarta la muestra que empieza dentro del primer segundo', () => {
      expect(muestraEnVentana(5_999, 6_499, pc)).toBe(false);
    });

    it('el borde de 1 s es inclusivo', () => {
      expect(muestraEnVentana(6_000, 6_500, pc)).toBe(true);
    });

    it('el borde de 10 s es inclusivo', () => {
      expect(muestraEnVentana(14_500, 15_000, pc)).toBe(true);
    });

    it('descarta la muestra que se pasa de 10 s', () => {
      expect(muestraEnVentana(14_600, 15_100, pc)).toBe(false);
    });

    it('descarta un cuadro largo que cruza el arranque', () => {
      expect(muestraEnVentana(5_200, 8_200, pc)).toBe(false);
    });

    describe('acumularFluidez: qué hace cada lectura de cuadros por segundo', () => {
      const nuevo = (anterior: number): EstadoFluidez => ({ anterior, muestras: [] });

      it('una lectura con el mismo fps pero otra cuenta de muestras es una muestra', () => {
        const e = nuevo(6_000);
        acumularFluidez(e, { fps: 60, muestras: 2 }, { fps: 60, muestras: 1 }, 6_500, pc);
        acumularFluidez(e, { fps: 60, muestras: 3 }, { fps: 60, muestras: 2 }, 7_000, pc);
        expect(e.muestras).toEqual([60, 60]);
      });

      it('una lectura con la misma cuenta de muestras se ignora y no mueve la lectura anterior', () => {
        const e = nuevo(6_000);
        acumularFluidez(e, { fps: 45, muestras: 1 }, { fps: 30, muestras: 1 }, 6_500, pc);
        expect(e.muestras).toEqual([]);
        expect(e.anterior).toBe(6_000);
      });

      it('el intervalo arranca en la lectura anterior: una muestra que cruza el segundo 1 queda fuera', () => {
        const e = nuevo(5_900);
        acumularFluidez(e, { fps: 30, muestras: 2 }, { fps: 0, muestras: 1 }, 6_400, pc);
        expect(e.muestras).toEqual([]);
        expect(e.anterior).toBe(6_400);
        acumularFluidez(e, { fps: 58, muestras: 3 }, { fps: 30, muestras: 2 }, 6_900, pc);
        expect(e.muestras).toEqual([58]);
      });

      it('una muestra que termina después de 10 s queda fuera', () => {
        const e = nuevo(14_600);
        acumularFluidez(e, { fps: 50, muestras: 2 }, { fps: 0, muestras: 1 }, 15_100, pc);
        expect(e.muestras).toEqual([]);
      });

      it('sin primer cuadro no cuenta ninguna muestra', () => {
        const e = nuevo(6_000);
        acumularFluidez(e, { fps: 60, muestras: 2 }, { fps: 0, muestras: 1 }, 6_500, undefined);
        expect(e.muestras).toEqual([]);
      });
    });

    it('el informe dice qué ventana mide', () => {
      const txt = informe(resumirCarga(datos), equipo, { promedio: 58, minimo: 41, muestras: 20 }, '2026-10-15');
      expect(txt).toContain('Cuadros por segundo (de 1 a 10 s tras el primer cuadro): promedio 58, mínimo 41');
    });
  });

  describe('tamaño del código desde la memoria del navegador (issue 85)', () => {
    const codigoKB = (r: Recurso) => resumirCarga({ recursos: [r], marcas: {} }).codigoKB;
    const js = 'https://brain.maysasp.com/assets/index-abc.js';

    it('una recarga desde la memoria da lo mismo que en frío', () => {
      expect(codigoKB(recurso(js, 50, 900, 0, 2_560_000, 680_000))).toBe(664);
    });

    it('una revalidación 304 cuenta el cuerpo, no los pocos bytes de cabeceras', () => {
      expect(codigoKB(recurso(js, 50, 900, 300, 2_560_000, 680_000))).toBe(664);
    });

    it('sin encodedBodySize, usa lo transferido', () => {
      expect(codigoKB(recurso(js, 50, 900, 680_000, 2_560_000, 0))).toBe(664);
    });

    it('sin ningún tamaño comprimido, da 0 y nunca el tamaño descomprimido', () => {
      expect(codigoKB(recurso(js, 50, 900, 0, 2_560_000, 0))).toBe(0);
    });
  });

  describe('umbral de "Lo más lento" (issue 85)', () => {
    const conPrimerCuadro = (primer: number | undefined) => {
      const marcas = { ...datos.marcas };
      if (primer === undefined) delete marcas[MARCA_PRIMER_CUADRO];
      else marcas[MARCA_PRIMER_CUADRO] = primer;
      return resumirCarga({ recursos: datos.recursos, marcas });
    };
    const texto = (r: ReturnType<typeof resumirCarga>) => informe(r, equipo, null, '2026-10-15');

    it('con más de 3000 ms, aparece', () => {
      const r = conPrimerCuadro(3_001);
      expect(cargaLenta(r)).toBe(true);
      expect(texto(r)).toContain('Lo más lento: la descarga del modelo 3D');
    });

    it('con 3000 ms exactos, no aparece', () => {
      const r = conPrimerCuadro(3_000);
      expect(cargaLenta(r)).toBe(false);
      expect(texto(r)).not.toContain('Lo más lento');
    });

    it('con 2500 ms, no aparece', () => {
      const r = conPrimerCuadro(2_500);
      expect(cargaLenta(r)).toBe(false);
      expect(texto(r)).not.toContain('Lo más lento');
    });

    it('sin primer cuadro, no aparece', () => {
      const r = conPrimerCuadro(undefined);
      expect(cargaLenta(r)).toBe(false);
      expect(texto(r)).not.toContain('Lo más lento');
    });

    it('lenta pero sin dato del código, dice sin dato', () => {
      const r = resumirCarga({ recursos: [], marcas: { [MARCA_PRIMER_CUADRO]: 4_000 } });
      expect(cargaLenta(r)).toBe(true);
      expect(texto(r)).toContain('Lo más lento: sin dato');
    });
  });

  describe('línea de densidad de píxeles (issue 84)', () => {
    const conDensidad = (densidad: Equipo['densidad']) =>
      informe(
        resumirCarga(datos),
        { navegador: 'Chrome', pantalla: '1920 x 1080 @1x', nucleos: 4, memoriaGB: 8, gpu: 'Intel', densidad },
        null,
        '2026-10-14',
      );

    it('fija con ?dpr, con coma decimal', () => {
      expect(conDensidad({ valor: 1.5, fija: true })).toContain('Densidad de píxeles del visor: 1,5 (fija con ?dpr)');
    });

    it('automática', () => {
      expect(conDensidad({ valor: 2, fija: false })).toContain('Densidad de píxeles del visor: 2 (automática)');
    });

    it('sin dato cuando no hay densidad', () => {
      expect(conDensidad(null)).toContain('Densidad de píxeles del visor: sin dato');
    });
  });
});
