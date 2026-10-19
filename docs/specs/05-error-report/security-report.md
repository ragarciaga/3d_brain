<!-- rockbuilt:security-report. Sin valores secretos; solo archivo y línea. -->
# Informe de seguridad: Reportar un error desde la ficha (F12)

Spec: [design.md](design.md)  |  Fecha: 2026-10-19  |  Commit: eb7f55f  |  Resultado: PASS

## Alcance
- Disparadores: entrada externa (texto libre del visitante que termina en `github.com/ragarciaga/3d_brain/issues/new` y en `mailto:`), datos personales (usuario de GitHub o correo de quien reporta, texto de Privacidad bajo la Ley 1581), código del revisor `r` en la misma página, formularios públicos de issue en `.github/ISSUE_TEMPLATE/`.
- Revisado: la unión de los PR #243, #244, #246, #247, #248, #249, #250 y #251 (22 archivos: `src/components/ReportarError.tsx`, `src/lib/reporte.ts`, `src/config/reporte.ts`, `Ficha.tsx`, `Pagina.tsx`, `Privacidad.tsx`, `src/lib/teclado.ts`, `src/store/useAtlas.ts`, `src/i18n/*.json`, `src/estilos.css`, las cuatro plantillas, sus pruebas y docs), más `.github/workflows/` y los filtros de `tools/rockbuilt`.

## Resumen
| Severidad | Cantidad |
|---|---|
| blocker | 0 |
| major | 0 |
| minor | 0 |

Dependencias (`npm audit --omit=dev`): critical 0, high 0, moderate 0, low 0

## Hallazgos
Ninguno.

## Revisado y limpio
- Autorización: no hay backend. El botón no se monta en modo revisión (`Ficha.tsx`, `!revisor`). Los enlaces se arman solo con props y `src/data`, nunca con `location` ni `document.referrer`. En el estado de revisión bloqueada (`?r=` en la URL, revisor nulo) el botón se ve pero ningún enlace lleva el código: lo prueban la e2e D1 y las pruebas unitarias con `location` falso. GitHub recibe `noreferrer`, y la meta `strict-origin` también lo cubre.
- Inyección: `URLSearchParams` codifica cada valor del enlace de GitHub, así que la descripción no puede meter `labels=`, `assignees=` ni cambiar `template`. `encodeURIComponent` en el asunto y el cuerpo del correo impide inyectar cabeceras `cc`, `bcc` o `to`. Los surrogates UTF-16 sueltos se cambian por U+FFFD antes de codificar. No hay `innerHTML` ni `dangerouslySetInnerHTML`. El título del issue sale de `src/data` y de i18n, no del visitante.
- Secretos: no hay secretos, URL del script ni variables `VITE_` en el diff; `PRUEBA01` es un código de prueba.
- Dependencias: sin cambios en `package.json` ni en el lockfile.
- SSRF y límite de peticiones: no hay `fetch` ni endpoint.
- Almacenamiento y red: el borrador vive en el estado del componente y se pierde al cerrar; la e2e R5.1 toma fotos de localStorage, sessionStorage, cookies e IndexedDB y registra cada petición.
- GitHub Actions ante issues nuevos: no hay ningún workflow con `on: issues` ni `issue_comment` (`rockbuilt-ci.yml` corre en pull_request y push con permisos de solo lectura; `pages.yml` en push a main).
- Trabajo del harness: el ciclo solo toma `rb:bug` y `rb:task` y descarta autores no confiables; `reporte:*` no entra en ningún filtro de `tools/rockbuilt`.

## No revisado
- R6.3 (que las cuatro etiquetas existan): el revisor no tenía acceso a la API. El orquestador lo comprobó en GitHub el 2026-10-19: `reporte:contenido`, `reporte:traduccion`, `reporte:enlace-roto` y `reporte:pieza` existen.
- El texto legal no es materia de esta revisión.

## Notas para el editor (sin exploit)
- Privacidad frente a la Ley 1581: el párrafo `reportes` describe bien lo que hace la app, pero `finalidades` y `base` no nombran el correo de quien reporta, `conservacionRevision` no dice cuánto se guardan los correos ni los issues de reporte, y `proveedores` no nombra quién aloja el buzón info@maysasp.com.
- R1.2 dice "código en la URL"; con la revisión bloqueada el botón se ve aunque la URL lleve `?r=`. No filtra el código (D1), pero el texto del criterio y el comportamiento no coinciden del todo.
- La descripción de un reporte llega a GitHub como markdown público y no confiable. Si algún día se pasa un `reporte:*` a un agente, ese texto es dato y no instrucción.
- Harness (no lo introduce F12, pero F12 invita al público a abrir issues): algunos puntos de Rockbuilt leen issues por título o por marcadores del cuerpo sin mirar el autor. Va como issue con recomendación en el repo de Rockbuilt.
