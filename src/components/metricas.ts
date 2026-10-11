import { create } from 'zustand';

/** Cuadros por segundo y piezas cargadas (para medir en los equipos de referencia). */
export const useMetricas = create<{ fps: number; piezas: number; setFps(n: number): void; setPiezas(n: number): void }>((set) => ({
  fps: 0,
  piezas: 0,
  setFps: (fps) => set({ fps }),
  setPiezas: (piezas) => set({ piezas }),
}));
