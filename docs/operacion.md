# Operación del atlas: guía del editor

Qué hacer, dónde y con qué comando. Todos los enlaces (sitio, formularios, logos, GitHub) están en
[docs/enlaces.md](enlaces.md). Para el porqué de cada decisión, ver `docs/adr/`; para el
alcance, `SPEC.md`; para las reglas que siguen los agentes, `AGENTS.md`.

## Mapa del repositorio

| Ruta | Qué es | Quién lo cambia |
|---|---|---|
| `SPEC.md` | Alcance y funciones (F1 a F25) | Tú; un cambio de alcance va aquí primero |
| `AGENTS.md` | Contrato del proyecto para agentes y personas | Tú (nivel C) |
| `docs/brief.md`, `docs/adr/` | Producto y decisiones | Tú (nivel C) |
| `docs/progress.md` | Estado actual y siguiente paso | Los agentes en cada cierre |
| `docs/v2.md` | Lo que se dejó para después y cuándo vuelve | Agentes y tú |
| `pipeline/` | Genera el modelo desde Z-Anatomy | Agentes; resultados nivel C |
| `public/modelos/atlas.glb`, `pipeline/cajas.json`, `pipeline/mapeo.csv` | Geometría y su verificación | Solo el pipeline (nivel C) |
| `src/data/` | Fichas, nombres, árbol, grupos, marcadores | Contenido anatómico: lo apruebas tú (nivel C) |
| `src/i18n/` | Textos de la interfaz en español e inglés | Agentes (nivel A) |
| `src/`, `scripts/`, `tests/`, `e2e/` | Código y pruebas | Agentes (nivel B) |
| `tools/rockbuilt/`, `.claude/`, `.github/workflows/rockbuilt-ci.yml` | Harness | Solo con `rb vendor` |

## Publicar el sitio (GitHub Pages)

Una sola vez: en GitHub, Settings > Pages > Build and deployment > Source: "GitHub Actions".

Después, cada merge a `main` publica solo (workflow `pages`). Para publicar a mano: Actions >
pages > Run workflow. El sitio queda en https://ragarciaga.github.io/3d_brain/ (español en
`/3d_brain/es`, inglés en `/3d_brain/en`).

Si el workflow falla en "configure-pages" con "Not Found", Pages no está activado.

## Revisión docente

Todo el flujo (formularios, códigos, enlaces, importación y verificación de fichas) está en
`docs/revision-docente.md`. Lo privado (padrón de códigos y enlaces de cada docente) está en la
carpeta "Maysa Brain (privado)" del Drive de Maysa Digital, nunca en el repositorio. A los docentes
se les envía el mensaje de `docs/guia-docentes.md`; la guía, las dudas y la lista de qué revisar
están dentro de la web, en el modo revisión.

## Regenerar el modelo

Solo hace falta si cambia la fuente o la selección de piezas. Pasos y comandos de PowerShell en
`pipeline/README.md`. Después de `node scripts\comprimir-modelo.ts`, corre
`node scripts\mallas-cerradas.ts`: regenera la lista de mallas cerradas que usan los cortes (F8) y
que `check:modelo` verifica; sin ella, `check:modelo` y CI fallan. Al terminar, `npm run check:modelo`
debe decir que todas las mallas están en su posición; si alguna se corrió más de 0,1 mm, no se sube.

## Correr la app en tu portátil

```powershell
cd C:\Users\TU_USUARIO\proyectos\3d_brain
npm ci
npm run dev
```

Abre http://localhost:3000. El número de cuadros por segundo aparece arriba a la derecha del visor.

## Medir la carga en tus equipos (issue 6)

Abre el sitio con `?medir=1` al final de la dirección, en cada equipo (iPad, celular, PC):

```
https://ragarciaga.github.io/3d_brain/es?medir=1
```

Aparece un panel con el equipo, la tarjeta gráfica, cuánto tardó el código, la descarga del modelo
3D, la preparación del modelo, cuándo se vio el cerebro y los cuadros por segundo de los 10 s
siguientes. Al final dice qué fue lo más lento. "Copiar resultados" copia todo como texto para
pegarlo en el issue 6 o en el chat. El panel sigue mientras navegas en esa pestaña; "Cerrar" lo
quita. No envía nada a ningún servidor.

Mide dos veces en cada equipo: la primera vez (el modelo se descarga) y recargando la página (el
modelo sale de la memoria del navegador). Si quieres una medición limpia, abre una pestaña privada.

## Trabajar con Claude Code y Rockbuilt

Desde una sesión de Claude Code en este repositorio:

| Quieres | Escribe |
|---|---|
| Saber en qué va el proyecto y qué sigue | `/rb-status` |
| Especificar una función nueva (por ejemplo F8) | `/rb-spec F8` |
| Construir una tarea o un issue | `/rb-build #13` |
| Corregir un error | `/rb-fix` y describes el error |
| Procesar el backlog de una vez | `/rb-cycle` |
| Fusionar un PR que espera tu aprobación | `/rb-merge #N` |
| Revisar cómo va el proceso | `/rb-retro` |

Niveles de autonomía (`Autonomy: auto` en `AGENTS.md`):

- **A** (pruebas, documentos, estilos, textos): se fusionan solos con CI verde.
- **B** (código de una tarea aprobada): se fusionan solos con CI verde y revisión ciega.
- **C** (anatomía, modelo, dependencias, CI y despliegue, decisiones): esperan tu aprobación. Te
  llegan como issue con la etiqueta `rb:needs-human`; respondes en el issue ("aprobado" o tu
  decisión) y quitas la etiqueta.

Para frenar todo trabajo autónomo, pon la etiqueta `rb:stop` en cualquier issue abierto (por
ejemplo en el issue #1, "Rockbuilt control"); quítala para reanudar.

### Ciclo nocturno (opcional)

En Claude Code, crea una rutina sobre este repositorio con horario (por ejemplo 01:07) y el prompt
exacto `Run /rb-cycle.`. Instrucciones en
https://github.com/ragarciaga/rockbuilt/blob/main/docs/CLOUD.md. Cada mañana, el resumen queda en
el issue #1.

## Pendientes que dependen de ti

Están como issues con `rb:needs-human` o `rb:needs-local`. `/rb-status` los lista en orden.
