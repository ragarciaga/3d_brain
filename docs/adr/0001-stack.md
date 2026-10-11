# 0001. Stack: SPA con Vite, React y React Three Fiber

Status: accepted
Date: 2026-10-11
Related: docs/brief.md, SPEC.md sección 10
Approved by: kickoff synthesis

## Context
La app corre entera en el navegador (sin backend), muestra un modelo 3D con cientos de piezas y debe ir fluida en un Android de gama baja. Rutas por idioma y estructura, interfaz bilingüe y búsqueda tolerante a errores. Los agentes trabajan mejor con tipos estrictos.

## Decision
Usaremos Node.js 24 LTS, TypeScript 6.0.3 estricto, Vite 8.3.4 y React 19.3.0, con three 0.186.1, @react-three/fiber 9.8.1 y @react-three/drei 10.7.9 para el 3D; zustand 5.0.15 para el estado; react-router 8.4.0; i18next 26.4.3 con react-i18next 17.0.16; fuse.js 7.5.0; idb-keyval 6.3.0; Vitest 5.0.3 y Playwright 1.64.0. Versiones exactas, sin `^`.

Herramientas de desarrollo (no llegan al navegador), también con versión exacta: ESLint 10.12.0 con
@eslint/js 10.0.1, typescript-eslint 8.71.1, eslint-plugin-react-hooks 7.1.1 y globals 17.13.0;
@playwright/mcp 0.0.83 (lo usa el `.mcp.json` del harness); @vitejs/plugin-react
6.1.2; @types/react, @types/react-dom, @types/three y @types/node; @gltf-transform/core,
/extensions y /functions 4.5.1 con meshoptimizer 1.3.0 para comprimir y verificar el modelo desde
Node (en lugar de @gltf-transform/cli, que arrastraba una dependencia con una vulnerabilidad
conocida). three-mesh-bvh 0.8.3 (la misma versión que ya trae drei) da a cada malla un raycast
acelerado explícito.

Node: `.nvmrc` fija 24 LTS. `engines` admite desde 22.18 porque el CI del harness
(`rockbuilt-ci`, archivo del harness) corre con Node 22, y 22.18 es la primera versión que ejecuta
los scripts `.ts` sin compilar.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Next.js | No hay lógica de servidor; agrega complejidad sin beneficio en un sitio estático |
| three.js sin React | Árbol, ficha, búsqueda y 3D comparten estado; R3F lo integra con React |
| TypeScript 7.0.2 | typescript-eslint soporta hasta la 6.0 a la fecha |
| Babylon.js | Ecosistema React menor; R3F y drei cubren controles, selección y etiquetas |

## Consequences
- Positive: un solo lenguaje, despliegue estático gratis, tipado estricto.
- Negative: R3F 9.8.1 exige React menor que 19.4; actualizar React depende de R3F.
- Revisit when: typescript-eslint soporte TS 7, o una medición muestre que React frena el render.
