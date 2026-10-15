import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// El sitio vive en la raíz del dominio propio (brain.maysasp.com, docs/adr/0014-dominio-propio.md), igual
// que en local y en las pruebas. El workflow de Pages aún pasa GITHUB_PAGES=true; ya no cambia la base.
export default defineConfig({
  base: '/',
  plugins: [react()],
  // El README y las pruebas E2E esperan http://localhost:3000; `--port` en la línea de comandos lo reemplaza.
  server: { port: 3000 },
  // three.js y React suman cerca de 450 kB comprimidos; el peso real del atlas es el GLB.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
