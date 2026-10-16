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
pages > Run workflow. El sitio queda en https://brain.maysasp.com/ (español en
`/es`, inglés en `/en`). El dominio es `brain.maysasp.com` (docs/adr/0014-dominio-propio.md); el
enlace viejo de github.io redirige solo al nuevo.

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
https://brain.maysasp.com/es?medir=1
```

Aparece un panel con el equipo, la densidad de píxeles del visor, la tarjeta gráfica, cuánto tardó
el código, la descarga del modelo 3D, la preparación del modelo, cuándo se vio el cerebro y los
cuadros por segundo. "Copiar resultados" copia todo como texto para pegarlo en el issue 6 o en el
chat. El panel sigue mientras navegas en esa pestaña; "Cerrar" lo quita. No envía nada a ningún
servidor.

La preparación del modelo viene desglosada en tres partes que suman el total: "Leer el modelo"
(parseo y decodificación), "Índice de toque" (los árboles BVH que hacen rápido el toque) y "Armar
las piezas" (piezas, cajas y centros). Si falta alguna marca, esa parte sigue en "midiendo..." en
el panel y dice "sin dato" en el informe copiado.

Los cuadros por segundo cuentan solo de 1 a 10 s después de que se ve el cerebro: el primer segundo
es arranque y compilación de sombreadores, y no dice qué tan fluido va el visor. Por eso los
promedios de antes del issue 85 no se comparan con los nuevos. "Lo más lento" solo aparece si el
cerebro tardó más de 3 s en verse; si no, no hace falta señalar nada.

Para comparar el mismo equipo con distinta densidad de píxeles, agrega `dpr=<n>` a la dirección:

```
https://brain.maysasp.com/es?medir=1&dpr=1
https://brain.maysasp.com/es?medir=1&dpr=1.5
```

Se aceptan valores de 0.5 a 3, con punto decimal; cualquier otro valor se ignora y queda el modo
automático. El valor vale mientras navegas en esa pestaña y se pierde si recargas sin él. El panel
y el informe copiado dicen la densidad en uso ("fija con ?dpr" o "automática").

Sin `?dpr`, la app ajusta la densidad sola: si el equipo va a menos de 30 cuadros/s durante unos 3 s
con el modelo cargado, baja la densidad un paso (a 1,5 y luego a 1); si va holgado (55 o más durante
10 s), la sube, como máximo dos veces por visita. En ese modo, la "Fluidez (de 1 a 10 s tras el primer cuadro)" puede mezclar
cuadros de antes y de después del ajuste, por eso las comparaciones se hacen con `?dpr`.

Mide dos veces en cada equipo: la primera vez (el modelo se descarga) y recargando la página (el
modelo sale de la memoria del navegador). Si quieres una medición limpia, abre una pestaña privada.

### Medir los cortes (issue 42)

Los cortes son lo que más le cuesta al equipo, así que se miden aparte, con los tres planos ya
activos desde la dirección (no hace falta activarlos a mano dentro de la ventana de 10 s del panel):

```
https://brain.maysasp.com/es?medir=1&corte=sagital:0,coronal:0,axial:0
```

En cada equipo de referencia (HP con Iris Xe, iPhone 12 Pro Max y el Android de gama baja), copia
los resultados con "Copiar resultados" y pégalos en el chat o en el issue, junto con una captura del
panel de cortes. Mide también sin cortes (`?medir=1` solo), para separar lo que cuestan los cortes
de lo que cuesta el modelo. Se cumple si el promedio da 30 cuadros/s o más con los tres planos.

Resultado del 16 de octubre de 2026:

| Equipo | Con los tres cortes | Sin cortes | Cerebro visible |
|---|---|---|---|
| HP, Edge 155, Iris Xe, densidad 1 | 60 (mínimo 51) | sin medir | 3,1 s |
| iPhone, Safari 26, densidad 2, 4G | 58 (mínimo 56) | sin medir | 5,6 s |
| Android 10 (Tecno), Chrome 154, PowerVR GE8300, 2 GB, densidad 1 | 3 (mínimo 1) | 25 (mínimo 10) | 7,8 a 11,3 s |

El HP y el iPhone cumplen. El Android de gama baja no: con cortes va a 3 cuadros/s aunque el relleno
se apague solo. Lo sigue el issue 177 (diagnóstico de los cortes en gama baja) y el 178 (el índice de
toque se arma después de ver el cerebro). El modo liviano (F19) queda diferido por decisión del
editor (ver docs/v2.md): sin cortes el mismo equipo va a 25 cuadros/s, que se usa bien para estudiar.

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
