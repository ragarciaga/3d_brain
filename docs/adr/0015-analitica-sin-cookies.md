# 0015. Analítica de visitas sin cookies con Cloudflare Web Analytics

Status: accepted
Date: 2026-10-15
Related: docs/adr/0014-dominio-propio.md, docs/adr/0003-datos-sin-backend.md, docs/adr/0012-apps-script-canal-revision.md, docs/enlaces.md
Approved by: el editor, en el chat del 2026-10-15

## Context
El ADR 0014 dejó la analítica fuera del cambio de dominio. El editor quiere saber cuánta gente visita brain.maysasp.com. AGENTS.md prohíbe las cookies de rastreo y los datos personales de usuarios en servidor. SPEC sección 13 (Privacidad, licencias y avisos) pide que, si se mide, sea sin cookies y sin datos personales, y que antes de agregar analítica con datos personales se revise con asesoría legal; en la sección 15 solo queda la pregunta abierta de si se mide o no.

## Decision
Se agrega el beacon de Cloudflare Web Analytics. No usa cookies ni almacenamiento local del navegador. Lo que envía a Cloudflare en cada visita: la URL de la página, el referrer, los tiempos de navegación y las métricas Web Vitals (con el selector del elemento), y Cloudflare procesa además la dirección IP y el agente de usuario del navegador. Con `"spa": false` no informa las navegaciones posteriores dentro de la app. El repositorio no contiene datos personales de nadie.

El plugin `analiticaCloudflare` de `vite.config.ts` agrega al `<head>` un cargador inline con `apply: 'build'`: aparece en `dist/index.html` y en `dist/404.html` (copia), y no en `npm run dev` ni en los e2e, que no salen a la red. El token del beacon es público por diseño y va en el HTML. Las dos líneas del repositorio que lo contienen (`vite.config.ts` y `tests/analitica.test.ts`) llevan el comentario `gitleaks:allow` porque el token es público, para que el escáner de secretos del CI no las marque. Hosts nuevos: `static.cloudflareinsights.com` (descarga del script) y `cloudflareinsights.com` (envío del beacon). El panel se consulta en la cuenta de Cloudflare del editor (docs/enlaces.md). La pantalla pública "Fuentes y licencia" lo avisa en los dos idiomas.

**El beacon nunca se carga en un navegador que está o estuvo en modo revisión.** La URL de revisión (`/es/revision?r=CODIGO`) lleva el código personal del docente, que funciona como llave al portador (ADR 0012), y el código recordado vive en `atlas:revisor`. Como el beacon informa la URL y el referrer, el cargador no crea su `<script>` si ocurre cualquiera de estas condiciones:
- la ruta empieza por `/es/revision` o `/en/revision`, o la URL trae el parámetro `r`;
- el referrer trae `r` o apunta a `/es/revision` o `/en/revision` (por ejemplo, una pestaña nueva abierta desde la URL de revisión);
- `localStorage` o `sessionStorage` guardan un `atlas:revisor` no vacío; se borra con "Salir del modo revisión", y desde ahí el beacon vuelve a cargarse.

La lectura de los almacenes y del referrer va en `try/catch`: si lanzan, se decide con las demás condiciones. Además `index.html` declara `<meta name="referrer" content="strict-origin">`, de modo que los enlaces dentro del sitio mandan solo el origen y el código no viaja en el referrer de una pestaña nueva. Así, en las visitas de ese navegador mientras sea revisor no se mide nada, y Cloudflare no recibe códigos de revisores por esta vía.

Confianza aceptada: en las páginas normales el beacon es un script de un tercero que se carga sin SRI (lo sirve Cloudflare y no tiene una versión fija a la cual atar un hash) y corre en el mismo origen que la app. Se acepta porque es el mecanismo oficial de Cloudflare, el sitio no guarda secretos en páginas normales y el navegador de un revisor no lo carga.

## Alternatives considered
| Opción | Por qué se descartó |
|---|---|
| Ninguna analítica | El editor no tendría ningún dato de uso para decidir qué mejorar |
| Analítica por proxy de Cloudflare (sin script en el HTML) | Exige pasar el registro DNS de "DNS only" a "Proxied", lo que cambia cómo se sirve el sitio (ADR 0014) |
| Beacon estático en todas las rutas | Enviaría a Cloudflare la URL de revisión con el código personal del docente |
| Beacon excluido solo por la ruta y por `?r=` | El código seguiría saliendo por el referrer de una pestaña nueva y por el código recordado en el navegador |

## Consequences
- Positive: cifras de visitas sin cookies, sin aviso de consentimiento y sin costo; los códigos de revisión no salen del navegador hacia Cloudflare.
- Neutral: dos hosts externos más en producción; no se cuentan las visitas de un navegador que es o fue revisor hasta que sale del modo revisión; cada cambio de token o de proveedor es un cambio de `vite.config.ts`.
- Negative: si un bloqueador de anuncios impide el script o el envío, esa visita no se cuenta y la app funciona igual. Un script de tercero sin SRI corre en las páginas normales.
- Revisit when: se quiera medir por estructura vista (eso exigiría eventos propios y una nueva revisión legal, SPEC sección 13), o cuando el canal de revisión (ADR 0012) deje un código en una URL o en una petición visible para scripts de terceros.
