<!-- rockbuilt:security-report. Sin valores secretos; solo archivo y línea. -->
# Informe de seguridad: Planos de corte (F8)

Spec: [design.md](design.md)  |  Fecha: 2026-10-17  |  Commit: b9b6756 (main) más el plan de pruebas  |  Resultado: PASS

## Alcance
- Disparadores: entrada externa por URL (`corte=`, y de paso `?medir=1` y `?dpr=`), ganchos de prueba en `window` (`__cortes`, `__puntoCorte`, `__atlas`, `__camara`, `__recorte`, `__marcadores`, `__retenerIndice`, `__sinVigilante`) y agotamiento de recursos con enlaces armados a propósito.
- Revisado: los PR de F8 y sus seguimientos (T1 a T10, #182, #183, #187 y #188) y los archivos actuales de la función: `src/lib/cortes.ts`, `src/lib/enlaces.ts`, `src/components/recorte.ts`, `Visor.tsx`, `ContornoCorte.tsx`, `PanelCortes.tsx`, `BarraFragmentar.tsx`, `Pagina.tsx`, `indiceToque.ts`, `src/store/useAtlas.ts`, `src/main.tsx` y los scripts `mallas-cerradas.ts`, `lib/mallas.ts` y `check-modelo.ts`.

## Resumen
| Severidad | Cantidad |
|---|---|
| blocker | 0 |
| major | 0 |
| minor | 0 |

Dependencias (`npm audit --omit=dev`): critical 0, high 0, moderate 0, low 0. La función no agrega dependencias.

## Hallazgos
Ninguno.

## Revisado y limpio
- Entrada `corte=`: expresión regular anclada y acotada (`-?\d{1,4}`, sin retroceso catastrófico), una entrada por plano (máximo 3, gana la primera), validación contra el rango del cerebro y `ajustarAlRango` en el store; aplicar el enlace dos veces da el mismo estado. Un enlace con muchas entradas o números enormes no cuesta más que leerlo.
- Entradas `?dpr=` (solo números finitos entre 0,5 y 3) y `?medir=1` (panel local; no envía nada a la red).
- "Compartir": solo lleva el estado del visor, nunca el código `r=` de revisión; si el portapapeles falla, el texto lo pinta React (escapado).
- Sin `innerHTML`, `dangerouslySetInnerHTML`, `eval` ni `new Function` en los archivos de la función; sin redirecciones abiertas.
- Ganchos de prueba: dentro de `if (import.meta.env.DEV)` en `src/main.tsx`. Comprobado sobre un build de producción nuevo de b9b6756: ninguno de `__cortes`, `__puntoCorte`, `__atlas`, `__camara`, `__fijarUrlCanal`, `__retenerIndice`, `__sinVigilante`, `__recorte`, `__marcadores` ni `planosDe` aparece en `dist/assets/*.js`.
- Sin `fetch` nuevos; el `MessageChannel` del índice de toque es privado.
- Scripts del pipeline: CLI locales del editor, rutas por argumento, sin red ni `exec`.
- Secretos: ninguna cadena con forma de llave ni variable de entorno secreta en las líneas de la función.

## No revisado
- Autenticación, backend, subidas de archivos y LLM: la función no los tiene.

## Notas para el editor (sin riesgo)
- Algunos componentes de ayuda de prueba se montan también en producción, pero nunca se cuelgan de `window`; montarlos solo en desarrollo es opcional.
- `cam=` (F11, anterior a esta función) acepta cualquier número finito; lo peor que logra un enlace raro es una vista vacía para quien lo abre.
- El conteo de visitas de Cloudflare ve la URL con `corte=`, que no tiene datos personales.
