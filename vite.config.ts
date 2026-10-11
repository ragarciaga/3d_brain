import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// En GitHub Pages el sitio vive en /3d_brain/; en local y en las pruebas, en la raíz.
const base = process.env.GITHUB_PAGES === 'true' ? '/3d_brain/' : '/';

export default defineConfig({
  base,
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
