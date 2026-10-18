<!-- rockbuilt:security-report -->
# Informe de seguridad: Propuestas para la sesión docente (marcadores y trazos del vago)

Spec: [design.md](design.md)  |  Fecha: 2026-10-18  |  Commit: 1a06f45  |  Resultado: PASS

## Alcance
- Disparadores: entrada externa en el pipeline (YAML de reglas, modelo 3D descargado que abre Blender, JSON que leen los scripts de Node antes de escribir `src/data/`), textos de los archivos de datos que muestra la interfaz (evidencia, fuentes, método), gancho de desarrollo en `src/main.tsx`, y la confirmación "Correcto" del docente, que se guarda en el navegador y viaja por el canal de revisión existente.
- Revisado: unión de los PR #113, #164, #172, #175, #203, #204, #206 y #209 (43 archivos).

## Resumen
| Severidad | Cantidad |
|---|---|
| blocker | 0 |
| major | 0 |
| minor | 0 |

Dependencias (`npm audit --omit=dev`): critical 0, high 0, moderate 0, low 0. El diff no agrega paquetes: `package.json` y `pipeline/requirements.txt` no cambian.

## Rutas de datos
| Entrada | Quién llama | Control | OK |
|---|---|---|---|
| `pipeline/ubicar-marcadores.py` (CLI local) | El editor, en su equipo | El modelo se abre con `abrir_blend` (`pipeline/comun.py:53`, `use_scripts=False`), desde un zip fijado por SHA-256. Las reglas se leen con `yaml.safe_load` (`pipeline/ubicar-marcadores.py:318`) | Sí |
| `pipeline/auditar-vago.py` (CLI local) | El editor | El mismo `abrir_blend`; escribe en rutas fijas de `pipeline/` | Sí |
| `scripts/aplicar-marcadores.ts`, `scripts/aplicar-trazos.ts` (CLI local) | El editor | `scripts/lib/*.ts` valida la entrada antes de escribir: llaves exactas, números finitos, y un id desconocido detiene todo. El resultado llega en un PR de nivel C | Sí |
| `src/data/marcadores.json` y `src/data/trazos-vago.json` en `Ficha.tsx` y `RevisionTrazo.tsx` | Datos del repositorio (nivel C) | React los muestra como texto. No hay `dangerouslySetInnerHTML` ni `innerHTML`, y ningún enlace se arma desde esos datos | Sí |
| "Correcto" de la posición (`Ficha.tsx`) | Revisor docente (F24) | Guarda solo estructura, campo, veredicto, versión y fecha, igual que las demás respuestas, y `respuestaValida` lo acepta. No se recoge ningún dato nuevo del docente | Sí |
| Gancho de desarrollo en `src/main.tsx` | Nadie en producción | Queda detrás de `if (import.meta.env.DEV)`. Los nombres del gancho no aparecen en `dist/assets/*.js` | Sí |

## Hallazgos
Ninguno.

## Revisado y limpio
- Autorización: no hay ruta de servidor nueva y el canal de revisión no cambia.
- Validación de entrada e inyección: `yaml.safe_load`. No hay `exec`, `eval`, `subprocess` ni `pickle` en el pipeline nuevo, y los JSON se validan antes de escribir.
- XSS: todo se muestra como texto de React. No hay URLs nuevas ni redirecciones.
- Secretos y registros: no hay llaves, tokens, URL del Apps Script ni variables `VITE_` en el diff.
- Dependencias: audit en 0 y ningún paquete nuevo.
- SSRF y llamadas externas: no hay hosts nuevos. El `.blend` se abre sin ejecutar sus scripts y el zip está fijado por hash.
- Datos personales: "Correcto" no recoge nada nuevo (Ley 1581, ADR 0012 sin cambios).
- No aplican: sesión, subida de archivos, límite de peticiones y LLM, porque no hay backend, ni subidas, ni IA.

## No revisado
- El Apps Script del editor (ADR 0012) y `src/lib/canal.ts`: quedan fuera del diff y no cambiaron.

## Notas
- La frase de design.md "Revisión de seguridad: no aplica" se sostiene. El único matiz es la respuesta nueva `posicion/correcto` en el canal F24: tiene la misma forma que las demás y la valida `respuestaValida`.
- La defensa clave contra un `.blend` con Python embebido es abrirlo con `use_scripts=False` (`pipeline/comun.py:53`). Todo script nuevo que abra el modelo debe conservarla.
