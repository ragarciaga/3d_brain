// Protección de los specs que entran en modo revisión (spec 03, T13). Desde T13 `configRevision.urlCanal`
// trae la URL real del Apps Script del editor, así que cualquier prueba con `?r=` saldría a ese script
// (con códigos de prueba y gastando su límite de ritmo). Dos defensas, que cada spec activa con una línea
// (`protegerCanalReal();` en el nivel superior del archivo):
//  1. Antes de la primera carga deja `__urlCanalInicial = ''` (costura de src/main.tsx) si nadie la fijó.
//     Es condicional para no pisar a `conCanal` de revision-canal.spec.ts, en cualquier orden de ejecución.
//  2. Una ruta de contexto aborta toda petición a los hosts de Apps Script y el `afterEach` hace fallar la
//     prueba si hubo alguna. Solo anota método, host y acción (de la query o del cuerpo POST, #169): nunca la
//     URL completa ni el cuerpo.
// La costura solo existe con el servidor de desarrollo (`import.meta.env.DEV`). Con `E2E_BASE_URL` apuntando a
// un build de producción o al sitio publicado, las pruebas del modo revisión fallan por la guarda en vez de
// salir a la red. Es intencional.
import { expect, test } from '@playwright/test';
import { lineaDeSalida } from './registro-canal';

const HOSTS = ['script.google.com', 'script.googleusercontent.com'];

let salidas: string[] = [];

export function protegerCanalReal(): void {
  test.beforeEach(async ({ context }) => {
    salidas = [];
    await context.addInitScript(() => {
      const w = window as unknown as { __urlCanalInicial?: string };
      if (typeof w.__urlCanalInicial !== 'string') w.__urlCanalInicial = '';
    });
    await context.route(
      (url) => HOSTS.includes(url.hostname),
      async (route) => {
        const peticion = route.request();
        salidas.push(lineaDeSalida(peticion.method(), new URL(peticion.url()), peticion.postData()));
        await route.abort('blockedbyclient');
      },
    );
  });

  test.afterEach(() => {
    expect(salidas, 'peticiones reales al canal del editor').toEqual([]);
  });
}
