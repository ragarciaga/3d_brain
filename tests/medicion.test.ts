import { describe, expect, it } from 'vitest';
import {
  cuelloDeBotella,
  informe,
  MARCA_INICIO_APP,
  MARCA_MODELO_LISTO,
  MARCA_PRIMER_CUADRO,
  resumirCarga,
  resumirFluidez,
  type Equipo,
  type Recurso,
} from '../src/lib/medicion';

const recurso = (name: string, startTime: number, responseEnd: number, transferSize: number, decodedBodySize = transferSize): Recurso => ({
  name,
  startTime,
  responseEnd,
  transferSize,
  decodedBodySize,
});

const datos = {
  recursos: [
    recurso('https://ragarciaga.github.io/3d_brain/assets/index-abc.js', 50, 900, 680_000, 2_560_000),
    recurso('https://ragarciaga.github.io/3d_brain/assets/index-abc.css', 50, 120, 4_400),
    recurso('https://ragarciaga.github.io/3d_brain/modelos/atlas.glb', 1_000, 4_000, 6_845_332),
  ],
  marcas: { [MARCA_INICIO_APP]: 950, [MARCA_MODELO_LISTO]: 4_600, [MARCA_PRIMER_CUADRO]: 4_700 },
};

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
