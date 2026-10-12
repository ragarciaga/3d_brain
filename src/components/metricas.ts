import { create } from 'zustand';

/** Cuadros por segundo, piezas cargadas y GPU (para medir en los equipos de referencia, issue 6). */
export const useMetricas = create<{
  fps: number;
  piezas: number;
  gpu: string;
  setFps(n: number): void;
  setPiezas(n: number): void;
  setGpu(g: string): void;
}>((set) => ({
  fps: 0,
  piezas: 0,
  gpu: '',
  setFps: (fps) => set({ fps }),
  setPiezas: (piezas) => set({ piezas }),
  setGpu: (gpu) => set({ gpu }),
}));
