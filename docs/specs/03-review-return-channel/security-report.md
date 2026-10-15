<!-- rockbuilt:security-report -->
# Informe de seguridad: canal de retorno de la revisión docente

Spec: [design.md](design.md)  |  Fecha: 2026-10-15  |  Commit: 16d7c48  |  Resultado: PASS

## Alcance
- Disparadores: datos personales (autorización Ley 1581 y respuestas en la hoja del editor), entrada externa (`?r=`, respuestas del canal, CSV del importador), host externo nuevo (`script.google.com` y su redirección `script.googleusercontent.com`), endpoint público (`doGet` y `doPost` del Apps Script), manejo de secretos (la URL `/exec` es pública por diseño; los códigos de revisor son llaves al portador).
- Revisado: `apps-script/Codigo.js`, `apps-script/prueba-canal.js`, `public/probar-canal.html`, `scripts/lib/revisiones.ts`, `src/components/{DialogoAutorizacion,Ficha,Pagina,PanelRevision,RevisionTrazo,SeccionTrazos}.tsx`, `src/config/revision.ts`, `src/lib/{canal,colaGuardado,persistencia,prioridad,respaldo,revision}.ts`, `src/main.tsx`, `src/store/useAtlas.ts`, i18n, `docs/guia-docentes.md`, `docs/revision-docente.md`, sus pruebas y la guarda `e2e/canal-real.ts`.

## Resumen
| Severidad | Cantidad |
|---|---|
| blocker | 0 |
| major | 1 |
| minor | 5 |

Dependencias (`npm audit --omit=dev`): critical 0, high 0, moderate 0, low 0

## Hallazgos
### S1 [major] El canal acepta `guardar` sin autorización registrada
- Dónde: `apps-script/Codigo.js` (`accionGuardar`, l. 218-226; `doPost`, l. 254-256). La única barrera está en el cliente (`src/components/PanelRevision.tsx`, `listo` y `enviar`).
- Categoría: authz
- Ataque: quien tiene un código activo manda `guardar` sin haber llamado nunca a `autorizar` y la fila entra en `Respuestas`; también un cliente con la autorización en caché y `leer` fallido sigue guardando aunque la fila de `Autorizaciones` ya no exista. La condición legal de este camino de datos personales depende solo del cliente.
- Arreglo: en `accionGuardar`, exigir `autorizacionDe(codigo)` con la versión vigente y devolver un error nuevo (`sin_autorizacion`); en el cliente, ese error vuelve a mostrar el diálogo. Opcional: que el importador cuente las filas de códigos sin autorización.
- Tarea: para decisión humana (exige cambiar `Codigo.js` y que vuelvas a desplegarlo).

### S2 [minor] La casilla del vago no se aplica en el servidor ni en el importador
- Dónde: `apps-script/Codigo.js` (`accionGuardar`), `scripts/lib/revisiones.ts` (`resumenMarkdown`), `src/lib/colaGuardado.ts` (`porEnviar`).
- Categoría: authz (integridad de datos)
- Ataque: un docente que dijo no revisar el vago envía a mano una respuesta de un trazo; sale en el resumen del importador como cualquier otra.
- Arreglo: que el importador marque o descarte las respuestas de trazos y rutas del vago de los códigos con `vago = no` en su última autorización.
- Tarea: para decisión humana.

### S3 [minor] Inundación con códigos inventados
- Dónde: `apps-script/Codigo.js` (`rechazoDeCodigo`, `ritmoPermitido`, `respuestasDe`).
- Categoría: rate-limit
- Ataque: peticiones concurrentes con códigos inventados agotan las ejecuciones simultáneas de la cuenta del editor (solo disponibilidad; sin costo, sin escritura, sin fuga). Adivinar un código no es viable (unos 2^39,6 combinaciones).
- Arreglo: guardar el Padrón en `CacheService` unos 60 s; opcional, un tope global por minuto y un límite diario por código en `guardar`.
- Tarea: para decisión humana.

### S4 [minor] `leer` manda el código en la query
- Dónde: `src/lib/canal.ts` (`leer`, l. 148).
- Categoría: secrets
- Ataque: un proxy con inspección TLS registra la URL completa (ya ve también la de la página `/es/revision?r=`).
- Arreglo: llevar el código en el fragmento (`#r=`) y hacer `leer` por POST, aceptando los dos formatos un tiempo.
- Tarea: para decisión humana (exige cambiar `Codigo.js`).

### S5 [minor] `?r=` queda en la barra de direcciones
- Dónde: `src/components/Pagina.tsx` (efecto de l. 131-140).
- Categoría: secrets
- Ataque: el docente proyecta o comparte la URL mientras sigue en `/es/revision?r=...`.
- Arreglo: tras `recordarRevisor`, reemplazar la URL sin `r` (`navigate(..., { replace: true })`).
- Tarea: para decisión humana (va junto con #149).

### S6 [minor] Claves locales con el código en claro que sobreviven a "Salir"
- Dónde: `src/components/PanelRevision.tsx` (`claveIdb`, `claveGuia`), `src/lib/persistencia.ts` (`olvidarRevisor`).
- Categoría: secrets
- Ataque: en un equipo compartido, el siguiente usuario lee el código en los nombres de las llaves locales.
- Arreglo: derivar las llaves de un hash del código y ofrecer "Borrar también de este equipo" al salir.
- Tarea: para decisión humana (va junto con #149).

## Revisado y limpio
- Autorización por datos: cada lectura y escritura filtra por el código validado contra el Padrón en el servidor; `leer` devuelve solo lo de ese código (R4.3).
- Validación de entrada: mismas reglas en el script y en la app; claves cerradas, sin `__proto__`; sin `innerHTML`; hoja escrita con formato `@`; importador con texto neutralizado.
- Secretos: ninguno en el repositorio; Padrón y salidas ignorados por git; errores del script sin mensajes de excepción; las costuras de prueba de `urlCanal` solo existen en desarrollo. Ningún código del padrón real aparece en el repositorio (comprobado).
- Dependencias: sin cambios en `package.json`; audit en cero.
- SSRF: no aplica (`probar-canal.html` restringe la URL a `script.google.com/.../exec`).

## No revisado
- El comportamiento real de cuotas y concurrencia de Apps Script en tu cuenta y el montaje de la implementación ("Ejecutar como Yo", "Cualquier usuario"): no se alcanzan desde la nube. Lo cubre tu prueba manual (D5 de #99).
- Conviene confirmar que la implementación de `apps-script/prueba-canal.js` (T1) quedó archivada, como dice `docs/revision-docente.md`.

## Notas
- `design.md` dice que un código validado no puede empezar con `-`, pero `REVISOR_VALIDO` lo permite; no es explotable (celdas con formato `@` y Padrón sin guion). Corregir la frase del design.
- Un enlace con otro código activo reemplaza el código recordado en el navegador; hace falta un código activo y que la víctima abra el enlace sin notarlo.
