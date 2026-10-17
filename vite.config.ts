import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Analítica de visitas sin cookies ni almacenamiento local (docs/adr/0015-analitica-sin-cookies.md).
// El token de Cloudflare Web Analytics es público por diseño: va en el HTML. Solo se inyecta en el build de
// producción (`apply: 'build'`): ni `npm run dev` ni los e2e, que usan el servidor de desarrollo, salen a la red.
// El beacon manda a Cloudflare la URL de la página y el referrer. En modo revisión la URL lleva el código
// personal del docente (`?r=`, una llave al portador), y el código recordado vive en `atlas:revisor`. Un
// cargador inline crea el `<script>` del beacon solo si esta página no se abrió en modo revisión (la ruta no es
// `/es/revision` ni `/en/revision`, la URL no trae `r`) y este navegador no recuerda un código (ni localStorage ni
// sessionStorage guardan `atlas:revisor`; se borra con "Salir del modo revisión"). El referrer es una defensa de
// reserva: con `strict-origin` los enlaces del sitio solo mandan el origen. El acceso a los almacenes y al
// referrer va en try/catch: si lanzan, se decide con lo demás. `"spa": false` evita que una navegación posterior
// dentro de la app reporte otra URL. Al crear el script también marca `<html>` (`data-beacon-cargado`) para
// `beaconCargado` (`src/lib/analitica.ts`). Una página abierta antes conserva su beacon; si la app va a adoptar un
// código en ella, recarga una vez en vez de activar el modo en caliente.
export const CARGADOR_BEACON = [
  '(function () {',
  '  var revision = /^\\/(es|en)\\/revision/;',
  '  if (revision.test(location.pathname) || new URLSearchParams(location.search).has("r")) return;',
  '  var almacenes = ["localStorage", "sessionStorage"];',
  '  for (var i = 0; i < almacenes.length; i++) {',
  '    try {',
  '      if (window[almacenes[i]].getItem("atlas:revisor")) return;',
  '    } catch (e) {}',
  '  }',
  '  try {',
  '    var anterior = new URL(document.referrer);',
  '    if (revision.test(anterior.pathname) || anterior.searchParams.has("r")) return;',
  '  } catch (e) {}',
  '  var s = document.createElement("script");',
  '  s.type = "module";',
  '  s.src = "https://static.cloudflareinsights.com/beacon.min.js";',
  '  s.setAttribute("data-cf-beacon", \'{"token": "393b091d66f04f2fbcaac4aaddd18567", "spa": false}\');', // gitleaks:allow
  '  document.documentElement.setAttribute("data-beacon-cargado", "1");',
  '  document.head.appendChild(s);',
  '})();',
].join('\n      ');

export function analiticaCloudflare(): Plugin {
  const cargador = `<script>\n      ${CARGADOR_BEACON}\n    </script>`;
  return {
    name: 'analitica-cloudflare',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/^([ \t]*)<\/head>/m, (_, sangria: string) => `${sangria}  ${cargador}\n${sangria}</head>`),
    },
  };
}

// El sitio vive en la raíz del dominio propio (brain.maysasp.com, docs/adr/0014-dominio-propio.md), igual
// que en local y en las pruebas. El workflow de Pages aún pasa GITHUB_PAGES=true; ya no cambia la base.
export default defineConfig({
  base: '/',
  plugins: [react(), analiticaCloudflare()],
  // El README y las pruebas E2E esperan http://localhost:3000; `--port` en la línea de comandos lo reemplaza.
  server: { port: 3000 },
  // three.js y React suman cerca de 450 kB comprimidos; el peso real del atlas es el GLB.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
