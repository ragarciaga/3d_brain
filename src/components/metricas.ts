import { create } from 'zustand';

/** Marcas de carga para ?medir=1 (issue 6): crea la marca solo la primera vez (React puede repetir el cálculo). */
export function marcarUnaVez(nombre: string): void {
  if (performance.getEntriesByName(nombre, 'mark').length === 0) performance.mark(nombre);
}

/**
 * Cuadros por segundo, piezas cargadas, GPU y densidad de píxeles (para medir en los equipos de
 * referencia, issue 6 y issue 84). `muestras` cuenta las lecturas de cuadros por segundo: cada `setFps`
 * es una muestra aunque el valor se repita. `densidad` vale 0 mientras no hay dato.
 */
export const useMetricas = create<{
  fps: number;
  muestras: number;
  piezas: number;
  gpu: string;
  densidad: number;
  densidadFija: boolean;
  setFps(n: number): void;
  setPiezas(n: number): void;
  setGpu(g: string): void;
  setDensidad(valor: number, fija: boolean): void;
}>((set) => ({
  fps: 0,
  muestras: 0,
  piezas: 0,
  gpu: '',
  densidad: 0,
  densidadFija: false,
  setFps: (fps) => set((s) => ({ fps, muestras: s.muestras + 1 })),
  setPiezas: (piezas) => set({ piezas }),
  setGpu: (gpu) => set({ gpu }),
  setDensidad: (densidad, densidadFija) => set({ densidad, densidadFija }),
}));
