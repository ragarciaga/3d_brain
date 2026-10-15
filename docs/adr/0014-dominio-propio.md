# 0014. Dominio propio brain.maysasp.com sobre GitHub Pages

Status: accepted
Date: 2026-10-15
Related: docs/adr/0005-hosting-github-pages.md, docs/enlaces.md
Approved by: el editor, en el chat del 2026-10-15

## Context
El atlas se publicaba en `ragarciaga.github.io/3d_brain/`, con la base `/3d_brain/` en el build. El editor quiere una dirección propia y corta para repartir a los docentes y a los estudiantes. El ADR 0005 dejó anotado revisar el hosting cuando se comprara un dominio propio.

## Decision
El sitio vive en `https://brain.maysasp.com`. El DNS está en Cloudflare con un registro CNAME `brain` hacia `ragarciaga.github.io`, en modo "DNS only" (sin proxy), y el hosting sigue en GitHub Pages con el despliegue desde GitHub Actions. Con dominio propio, Pages sirve el sitio en la raíz, así que la base de Vite pasa a `/` siempre y los enlaces del repositorio y de la documentación apuntan al dominio nuevo. El enlace viejo redirige solo al dominio nuevo, de modo que los enlaces ya repartidos siguen funcionando. Los enlaces a `github.com/ragarciaga/3d_brain` (repositorio, issues, Actions) no cambian. La analítica queda fuera de este cambio y se decide aparte.

## Alternatives considered
| Opción | Por qué se descartó |
|---|---|
| Cloudflare Pages | Obliga a rehacer el despliegue y el CI; por ahora no aporta nada que GitHub Pages no dé |
| Dejar el dominio de github.io | No cumple lo que pide el editor: una dirección propia y corta |

## Consequences
- Positive: dirección propia y estable; si algún día cambia el hosting, los enlaces repartidos no se rompen; sigue sin costo ni cuentas nuevas.
- Neutral: las rutas profundas (`/es/hipocampo`, `/es/revision?r=CODIGO`) siguen cargando porque `npm run build` corre `scripts/postbuild.ts`, que publica `404.html` como copia de `index.html` (ADR 0005); una prueba lo fija.
- Negative: el dominio y su renovación dependen de la cuenta del editor; el HTTPS de GitHub Pages tarda en emitirse tras un cambio de DNS.
- Revisit when: se necesiten reescrituras de ruta, cabeceras propias o analítica del lado del servidor que GitHub Pages no ofrezca.
