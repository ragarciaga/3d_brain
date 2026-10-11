# 0005. Hosting en GitHub Pages

Status: accepted
Date: 2026-10-11
Related: docs/brief.md
Approved by: kickoff synthesis

## Context
Sitio estático, gratuito, en el mismo GitHub del repositorio (que ya es público). Rutas por idioma (`/es/amigdala`) con react-router.

## Decision
Publicaremos en GitHub Pages con un despliegue desde GitHub Actions. Para que las rutas profundas funcionen se publica una copia de `index.html` como `404.html`; F20 (fase 2) reemplazará eso por páginas estáticas reales por estructura.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Vercel | El plan gratuito es para uso personal no comercial y agrega otra cuenta; reescrituras más limpias, pero no hacen falta |
| Cloudflare Pages | Igual de válido; agrega otra cuenta sin ventaja clara |

## Consequences
- Positive: costo cero, sin cuentas nuevas, mismo lugar que el código.
- Negative: el truco de `404.html` responde con código 404 en rutas profundas hasta F20; límite de 1 GB por sitio.
- Revisit when: se compre dominio propio o F20 exija reescrituras más finas.
