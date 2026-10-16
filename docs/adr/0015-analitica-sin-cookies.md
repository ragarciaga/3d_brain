# 0015. Analítica de visitas sin cookies con Cloudflare Web Analytics

Status: accepted
Date: 2026-10-15
Related: docs/adr/0014-dominio-propio.md, docs/adr/0003-datos-sin-backend.md, docs/adr/0012-apps-script-canal-revision.md, docs/enlaces.md
Approved by: el editor, en el chat del 2026-10-15
Amended: 2026-10-16, #168 (página Privacidad); 2026-10-16, #149 (adopción con beacon, `?r=` fuera de la barra, alcance por página)

## Context
El ADR 0014 dejó la analítica fuera del cambio de dominio. El editor quiere saber cuánta gente visita brain.maysasp.com. AGENTS.md prohíbe las cookies de rastreo y los datos personales de usuarios en servidor. SPEC sección 13 (Privacidad, licencias y avisos) pide que, si se mide, sea sin cookies y sin datos personales, y que antes de agregar analítica con datos personales se revise con asesoría legal; en la sección 15 solo queda la pregunta abierta de si se mide o no.

## Decision
Se agrega el beacon de Cloudflare Web Analytics. No usa cookies ni almacenamiento local del navegador. Lo que envía a Cloudflare en cada visita: la URL de la página, el referrer, los tiempos de navegación y las métricas Web Vitals (con el selector del elemento), y Cloudflare procesa además la dirección IP y el agente de usuario del navegador. Con `"spa": false` no informa las navegaciones posteriores dentro de la app. El repositorio no contiene datos personales de nadie.

El plugin `analiticaCloudflare` de `vite.config.ts` agrega al `<head>` un cargador inline con `apply: 'build'`: aparece en `dist/index.html` y en `dist/404.html` (copia), y no en `npm run dev` ni en los e2e, que no salen a la red. El token del beacon es público por diseño y va en el HTML. Las dos líneas del repositorio que lo contienen (`vite.config.ts` y `tests/analitica.test.ts`) llevan el comentario `gitleaks:allow` porque el token es público, para que el escáner de secretos del CI no las marque. Hosts nuevos: `static.cloudflareinsights.com` (descarga del script) y `cloudflareinsights.com` (envío del beacon). El panel se consulta en la cuenta de Cloudflare del editor (docs/enlaces.md). La pantalla pública "Fuentes y licencia" lo avisa en los dos idiomas y enlaza a la página Privacidad (`/es/privacidad`, `/en/privacy`, #168), que detalla qué procesa Cloudflare, la base (interés legítimo), la transferencia a EE. UU. y cómo ejercer los derechos.

**El beacon no se carga en las páginas que se abren en modo revisión ni mientras el navegador recuerda un código de revisor.** La URL de revisión (`/es/revision?r=CODIGO`) lleva el código personal del docente, que funciona como llave al portador (ADR 0012), y el código recordado vive en `atlas:revisor`. Como el beacon informa la URL y el referrer, el cargador no crea su `<script>` si ocurre cualquiera de estas condiciones:
- la ruta empieza por `/es/revision` o `/en/revision`, o la URL trae el parámetro `r`;
- el referrer trae `r` o apunta a `/es/revision` o `/en/revision`; es solo una defensa de reserva, porque con `strict-origin` los enlaces del sitio mandan solo el origen y el referrer completo únicamente llegaría de un navegador que no respete la meta;
- `localStorage` o `sessionStorage` guardan un `atlas:revisor` no vacío; "Salir del modo revisión" lo borra, y desde la siguiente carga de página el beacon vuelve a cargarse, salvo que se cumpla otra condición.

La lectura de los almacenes y del referrer va en `try/catch`: si lanzan, se decide con las demás condiciones. Además `index.html` declara `<meta name="referrer" content="strict-origin">`, de modo que los enlaces dentro del sitio mandan solo el origen. Una pestaña nueva abierta desde el modo revisión no se mide porque el navegador recuerda el código, no por el referrer. Así, en las páginas que ese navegador abre mientras recuerda un código no se mide nada, y Cloudflare no recibe códigos de revisores por esta vía.

**Alcance por página.** La condición vale para cada carga de página, no para el navegador entero:
- una página abierta antes conserva su beacon; ocurre con la que restaura Atrás desde la caché del navegador (bfcache) o con otra pestaña que ya estaba abierta;
- esa página puede enviar su conteo final al cerrarse o recargarse, también por la recarga que describe el párrafo siguiente;
- ese envío lleva la URL de esa página, que nunca tiene el código.

**Recarga al adoptar un código.** Si la app va a adoptar un código de revisor (del enlace o recordado) en una página que tiene el beacon (`script[data-cf-beacon]` o `data-beacon-cargado` en `<html>`, que el cargador pone al crear el script), no activa el modo en caliente: recarga la página. Es como mucho una recarga por intento de adopción (`atlas:recarga-revision` en sessionStorage; la marca se borra al adoptar, `decidirAdopcion` en `src/lib/analitica.ts`). En la rama que recarga la app no escribe el código antes: si vino de `?r=`, la URL que se recarga lo lleva, y si vino del almacén, ya estaba recordado. Tras la recarga el cargador ve el código y no crea el beacon. Si la página sigue con el beacon después de esa recarga, o no se puede escribir la marca, la app no activa el modo y muestra un aviso para abrir el enlace en una pestaña nueva.

**URL.** Al adoptar el código del enlace, la app reemplaza la URL por la misma sin `r` (los demás parámetros se conservan). Atrás no vuelve a la URL con el código, pero el historial del navegador conserva la URL visitada.

Confianza aceptada: en las páginas normales el beacon es un script de un tercero que se carga sin SRI (lo sirve Cloudflare y no tiene una versión fija a la cual atar un hash) y corre en el mismo origen que la app. Se acepta porque es el mecanismo oficial de Cloudflare y el sitio no guarda secretos en páginas normales. Una página abierta antes de entrar en modo revisión conserva ese script, y mientras siga abierta el script puede leer el código recordado (comparte origen y almacenamiento con la app). La mitigación es la recarga de arriba y cerrar las pestañas viejas; no se afirma que el navegador de un revisor nunca ejecute el beacon.

## Alternatives considered
| Opción | Por qué se descartó |
|---|---|
| Ninguna analítica | El editor no tendría ningún dato de uso para decidir qué mejorar |
| Analítica por proxy de Cloudflare (sin script en el HTML) | Exige pasar el registro DNS de "DNS only" a "Proxied", lo que cambia cómo se sirve el sitio (ADR 0014) |
| Beacon estático en todas las rutas | Enviaría a Cloudflare la URL de revisión con el código personal del docente |
| Beacon excluido solo por la ruta y por `?r=` | El código recordado seguiría expuesto en las páginas sin `?r=`, y un referrer completo lo llevaría si faltara la meta `strict-origin` |

## Consequences
- Positive: cifras de visitas sin cookies, sin aviso de consentimiento y sin costo; los códigos de revisión no salen del navegador hacia Cloudflare.
- Neutral: dos hosts externos más en producción; no se cuentan las páginas que abre un navegador mientras recuerda un código de revisor; tras salir, vuelven a contarse desde la siguiente carga; una página abierta antes puede enviar su conteo; cada cambio de token o de proveedor es un cambio de `vite.config.ts`.
- Negative: si un bloqueador de anuncios impide el script o el envío, esa visita no se cuenta y la app funciona igual. Un script de tercero sin SRI corre en las páginas normales.
- Revisit when: se quiera medir por estructura vista (eso exigiría eventos propios y una nueva revisión legal, SPEC sección 13), o cuando el canal de revisión (ADR 0012) vuelva a poner un código en una URL o en una petición visible para scripts de terceros. Esa condición ya se cumplió una vez: `leer` iba por GET con el código en la query, y desde #169 va por POST con el código en el cuerpo (`src/lib/canal.ts`; el `doGet` de `apps-script/Codigo.js` responde `formato` a todo GET).
