# Revisión docente (F24): guía del editor

La app no tiene servidor propio. Cada respuesta de un docente se guarda sola en una hoja de Google
del editor, mediante un Apps Script de su cuenta (ADR 0012, spec en
`docs/specs/03-review-return-channel/`). El formulario de revisión de Google queda como respaldo.
Mientras `urlCanal` de `src/config/revision.ts` esté vacía, el formulario es el único camino (R7.2).

Los docentes no leen documentos: la guía ("Cómo revisar"), la lista priorizada ("Qué revisar") y las
dudas abiertas están dentro de la web, en el modo revisión. A cada docente solo se le manda el
mensaje corto de `docs/guia-docentes.md` con su enlace.

## Probar el canal antes de construirlo (T1, #87)

Antes de construir el canal definitivo hay que confirmar que una página publicada en GitHub Pages
puede escribir en un Apps Script tuyo y leer lo que responde. Es una prueba corta, con un script
mínimo (`apps-script/prueba-canal.js`) y una hoja de prueba aparte. El script completo
(`Codigo.js`) se monta con los pasos de la sección "1. Montar el canal".

1. En el Drive de Maysa Digital, crea una hoja de cálculo nueva, por ejemplo "Prueba canal Maysa Brain".
2. En la hoja, menú Extensiones, Apps Script. Borra todo lo que trae `Código.gs`.
3. Copia el script. Desde la carpeta del repositorio, en PowerShell:

   ```powershell
   cd C:\Users\TU_USUARIO\proyectos\3d_brain
   Get-Content -Raw -Encoding UTF8 apps-script\prueba-canal.js | Set-Clipboard
   ```

   (Alternativa: abre `apps-script/prueba-canal.js` en GitHub y copia todo el contenido.) Pégalo en
   el editor de Apps Script y pulsa Guardar.
4. Arriba a la derecha, Implementar, Nueva implementación. En el engranaje elige el tipo
   "Aplicación web", Ejecutar como "Yo" y Quién tiene acceso "Cualquier usuario". Pulsa Implementar y
   autoriza los permisos. Si Google avisa que la app no está verificada, pulsa Configuración
   avanzada e Ir a (nombre del proyecto): es tu propio script.
5. Copia la "URL de la aplicación web". Termina en `/exec`.
6. Cuando la página esté publicada (después de fusionar el PR y de que termine el workflow `pages`),
   abre https://brain.maysasp.com/probar-canal.html, pega la URL y pulsa "Probar".
7. Mira la pestaña `Prueba` de la hoja: debe haber una fila con la fecha y la marca que muestra la
   página.

Cómo leer el resultado:

| Escritura | Lectura | Qué significa |
|---|---|---|
| ok | ok | El diseño sigue como está. |
| falla | ok | Plan B: la escritura se envía sin leer la respuesta y se confirma con la lectura. Avisa antes de construir lo demás. |
| cualquiera | falla | Avisa: el diseño cambia antes de construir el canal. |

Pega en el issue #87 las dos líneas ("Escritura: ..." y "Lectura: ...") y el detalle que muestra la
página. Si la URL que copiaste tiene la forma `/a/macros/<dominio>/...` (cuenta de Google
Workspace), dilo también en el issue.

Cuando termines, archiva la implementación para que nadie más pueda escribir en la hoja: en Apps
Script, Implementar, Gestionar implementaciones, Archivar.

## Estado

| Pieza | Dónde está |
|---|---|
| Hoja del canal | Se crea en el Drive de Maysa Digital con los pasos de la sección 1. Tiene tres pestañas: `Respuestas`, `Autorizaciones` y `Padrón` |
| Script del canal | `apps-script/Codigo.js`, pegado en la hoja del canal (sección 1) |
| `urlCanal` | Llena en `src/config/revision.ts` desde T13 (#99) con la URL `/exec` del script. Si se vacía, la app vuelve al formulario como único camino |
| Formulario de revisión (respaldo) | "Revisión del atlas Maysa Brain", Drive de Maysa Digital, conectado en `src/config/revision.ts` |
| Formulario de registro (se retira con el canal) | "Registro de revisores del atlas Maysa Brain", Drive de Maysa Digital. Enlace para docentes: https://docs.google.com/forms/d/e/1FAIpQLSdy6h0gI-nrX6s_ZMGq9PSsSTYxhSd0e7ZVDx4p0_QvgHrJ2A/viewform |
| Códigos de revisor | 10 creados (alias D01 a D10). Padrón y enlaces en la carpeta privada "Maysa Brain (privado)" del Drive de Maysa Digital; nunca en el repositorio |
| Guía para docentes | Dentro de la web: botón "Cómo revisar" del modo revisión (se abre sola la primera vez) |
| Mensaje para cada docente | `docs/guia-docentes.md` |
| Dudas abiertas | `src/data/dudas.json` (registro en `docs/fichas-dudas.md`); salen en cada ficha con su campo `duda.N` |

Si solo vas a invitar docentes con el canal ya publicado, salta a la sección 3.

## 1. Montar el canal

El canal es `apps-script/Codigo.js` pegado en una hoja de Google tuya. El script va ligado a esa hoja
(`@OnlyCurrentDoc`): solo puede leer y escribir en ella.

1. En el Drive de Maysa Digital, crea una hoja de cálculo nueva, por ejemplo "Canal de revisión Maysa Brain".
2. Crea tres pestañas con estos nombres exactos y una fila de cabecera en cada una. El script salta
   la primera fila de cada pestaña y escribe siempre al final, así que la cabecera no puede faltar:
   - `Respuestas`: A Recibido, B Código, C Estructuras, D Carga.
   - `Autorizaciones`: A Código, B Fecha, C Versión, D Vago.
   - `Padrón`: A Código, B Alias, C Activo.

   Si falta una pestaña o el nombre difiere (por ejemplo `Padron` sin tilde), el script responde un
   error interno.
3. En la hoja, menú Extensiones, Apps Script. Borra todo lo que trae `Código.gs`.
4. Copia el script. Desde la carpeta del repositorio, en PowerShell:

   ```powershell
   cd C:\Users\TU_USUARIO\proyectos\3d_brain
   Get-Content -Raw -Encoding UTF8 apps-script\Codigo.js | Set-Clipboard
   ```

   (Alternativa: abre `apps-script/Codigo.js` en GitHub y copia todo el contenido.) Pégalo en el
   editor de Apps Script y pulsa Guardar.
5. Arriba a la derecha, Implementar, Nueva implementación. En el engranaje elige el tipo
   "Aplicación web", Ejecutar como "Yo" y Quién tiene acceso "Cualquier usuario". Pulsa Implementar y
   autoriza los permisos. Si Google avisa que la app no está verificada, pulsa Configuración
   avanzada e Ir a (nombre del proyecto): es tu propio script.
6. Copia la "URL de la aplicación web". Termina en `/exec`. Esa URL no es secreta: desde T13 está
   publicada dentro de la app, y cualquiera podrá verla. Regla del editor, no una protección: la
   URL se pasa solo por chat a la sesión que construye T13, y nunca en un issue, un PR ni un
   comentario.
7. Prueba rápida, en el navegador, con una fila de prueba y no con el código de un docente real.
   En `Padrón`, agrega una fila inventada: un código de prueba aleatorio de 8 caracteres, generado
   como lo hace `scripts/crear-revisores.ts` y que no se parezca a los reales, alias `D99` y Activo
   `sí`. Con el canal publicado en la app, un código fijo y conocido dejaría escribir en la hoja a
   cualquiera: no lo escribas en ningún archivo del repositorio, y no lo compartas en un issue ni en
   un PR. Abre `<URL>?accion=leer&r=<código de prueba>` (esta prueba usa el GET de compatibilidad
   del script; la app lee por POST y no pone el código en la URL): debe devolver `{"ok":true,...}`.
   Cambia Activo a `no` (o borra la fila), espera un minuto (el script guarda `Padrón` unos 60 s) y
   vuelve a abrirla: debe devolver `{"ok":false,"error":"codigo_no_activo"}`. Al terminar, borra las filas de ese código en
   `Respuestas` y `Autorizaciones` y déjalo en `no` en `Padrón`, para que no llegue al importador.

Para actualizar el script sin cambiar la URL, edita la implementación existente: Implementar,
Gestionar implementaciones, el lápiz, Versión: Nueva versión, Implementar. No crees una
implementación nueva: cambiaría la URL y habría que volver a pasarla.

### Actualización: guardar exige la autorización (#157)

Desde #157, `guardar` en `apps-script/Codigo.js` solo escribe en `Respuestas` si la última fila del
código en `Autorizaciones` tiene la versión vigente de la autorización (Ley 1581). Si no, responde
`sin_autorizacion` y no escribe nada. Hasta que vuelvas a desplegar el script, la hoja sigue
aceptando respuestas sin esa comprobación. Hay que volver a desplegar `Codigo.js` como "Nueva versión"
de la implementación existente: la URL `/exec` no cambia. En este orden:

1. Primero espera a que el PR de #157 esté fusionado y a que termine el workflow `pages`, para que la
   web ya publicada entienda `sin_autorizacion`. La app vieja lo tomaría por un error interno y
   reintentaría con esperas cada vez más largas.
2. El mismo día, y antes de mandar los enlaces a los docentes, copia el script con el mismo bloque
   PowerShell del paso 4 (`Get-Content -Raw -Encoding UTF8 apps-script\Codigo.js | Set-Clipboard`).
3. En Apps Script, selecciona todo `Código.gs`, pega y pulsa Guardar.
4. Implementar, Gestionar implementaciones, el lápiz, Versión: Nueva versión, Implementar. Nunca
   "Nueva implementación".
5. Comprueba que la URL de la aplicación web que muestra Google es la misma que ya está en
   `src/config/revision.ts`. Si cambió, no la pegues en ningún issue: avísalo por chat.
6. Comprueba que funciona. Repite la prueba rápida del paso 7 con el código de prueba:
   1. Márcalo `sí` en `Padrón`.
   2. Abre la app con su enlace, responde un campo, acepta el diálogo y espera "Guardado ✓". En
      `Acciones`, cambia la casilla del vago: así `Autorizaciones` queda con dos filas del código
      (una por cada aceptación y por cada cambio de esa casilla).
   3. Borra todas sus filas en `Autorizaciones`.
   4. Responde otro campo: el diálogo debe volver a salir y `Respuestas` no debe ganar ninguna fila
      hasta que aceptes.
   5. Al terminar, limpia como dice el paso 7.

Si cambias `VERSION_AUTORIZACION` en `src/config/revision.ts`, cambia la constante igual en
`apps-script/Codigo.js` (una prueba falla si difieren) y vuelve a desplegar el script como nueva
versión apenas se publique la app. Si no, el docente acepta y el diálogo vuelve a salir, una y otra vez.

### Actualización: autorización v2 y v3, leer por POST y caché del Padrón (#162 y #168)

Desde #162 cambian cuatro cosas, y las cuatro salen en el mismo despliegue de `apps-script/Codigo.js`:

- El texto del diálogo de autorización avisa que las propuestas y los comentarios pueden publicarse con
  el alias del docente (por ejemplo D01, nunca su nombre) en issues públicos del proyecto en GitHub.
- `VERSION_AUTORIZACION` pasa de `1` a `2` (#162) y a `3` (#168), en `src/config/revision.ts` y en
  `Codigo.js`. Toda autorización de las versiones `1` y `2` deja de valer y la app vuelve a pedir la
  aceptación del texto nuevo. Ningún docente ha autorizado todavía, así que a nadie se le pide dos veces.
- La app lee por POST (`{accion:'leer', r}`) y ya no pone el código de revisor en la URL. El script
  sigue respondiendo el GET `?accion=leer&r=` por compatibilidad (la prueba rápida del paso 7 lo usa)
  hasta que se retire en otro cambio.
- El script guarda la lista de códigos activos de `Padrón` unos 60 s en `CacheService`, en vez de leer la
  hoja en cada petición. Un código que pasas a `no`, o uno nuevo con `sí`, cambia como mucho en un minuto.

#168 vuelve a cambiar el texto del diálogo: nombra al responsable (Maysa Strategy Partners) y el contacto
(info@maysasp.com) y enlaza a la página Privacidad. `VERSION_AUTORIZACION` sube a `3` en
`src/config/revision.ts` y en `Codigo.js`. Como el script aún no se ha desplegado con #162, un solo
despliegue cubre las versiones 2 y 3 juntas: despliégalo una sola vez, cuando los dos PR estén fusionados.

Antes de la primera importación, confirma que `Respuestas` no tiene filas de códigos reales cuya última
autorización en `Autorizaciones` sea la versión `1` o `2`: esas respuestas se aceptaron con un texto
anterior (el `1` no avisaba de la publicación del alias y el `2` no nombraba al responsable ni el
contacto). Hoy la hoja está vacía (la limpiaste el 2026-10-16).

Hay que volver a desplegar `Codigo.js` como "Nueva versión" de la implementación existente. En este
orden, con el sitio primero y el script después:

1. Espera a que los PR de #162 y de #168 estén fusionados y a que termine el workflow `pages`. Si solo
   uno está fusionado, espera al otro: el script se despliega una sola vez.
2. El mismo día, y antes de mandar los enlaces a los docentes, copia el script. En PowerShell:

   ```powershell
   cd C:\Users\TU_USUARIO\proyectos\3d_brain
   Get-Content -Raw -Encoding UTF8 apps-script\Codigo.js | Set-Clipboard
   ```

3. En Apps Script, selecciona todo `Código.gs`, pega y pulsa Guardar.
4. Implementar, Gestionar implementaciones, el lápiz, Versión: Nueva versión, Implementar. Nunca
   "Nueva implementación".
5. Comprueba que la URL de la aplicación web que muestra Google es la misma que ya está en
   `src/config/revision.ts`. Si cambió, no la pegues en ningún issue: avísalo por chat.
6. Comprueba que funciona, con el código de prueba del paso 7:
   1. Márcalo `sí` en `Padrón` y espera un minuto (la caché del `Padrón`).
   2. Abre la app con su enlace y responde un campo. El diálogo debe nombrar el alias y los issues
      públicos, al responsable y el contacto, y tener el enlace "Lee el aviso de privacidad". Acepta y
      espera "Guardado ✓".
   3. En `Autorizaciones`, la fila nueva del código debe tener la Versión `3`. Recarga la página: el
      diálogo no debe volver.
   4. Cambia Activo a `no` en `Padrón`, espera un minuto y recarga: debe aparecer "Tu código no está
      activo; escribe al editor".
   5. Limpia como dice el paso 7.

Entre el paso 1 y el 4, el sitio y el script no coinciden: la lectura de la app falla (el script viejo
responde `formato` a la lectura por POST) y `guardar` responde `sin_autorizacion`. Por eso van seguidos
y antes de mandar los enlaces.

## 2. Cuidar el padrón

`Padrón` decide qué códigos pueden escribir. La hoja del canal no se comparte con nadie: quien tenga
acceso a la hoja ve todos los códigos activos de `Padrón`, y con un código se pueden leer y escribir
las respuestas de ese docente.

- Una fila por código. La columna Activo lleva exactamente `sí` (con tilde y sin espacios) o `no`.
  Con cualquier otro valor el código no está activo.
- Antes de pegar filas, selecciona la columna A y ponla en texto sin formato (Formato, Número, Texto
  sin formato). Un código solo de dígitos se convertiría en número y dejaría de coincidir.
- Para copiar los códigos desde el padrón privado, en PowerShell, desde la carpeta del repositorio.
  Copia filas `código`, `alias` y `sí` separadas por tabulaciones, listas para pegar en A2:

  ```powershell
  cd C:\Users\TU_USUARIO\proyectos\3d_brain
  $si = "s$([char]0xED)"
  (Get-Content -Raw -Encoding UTF8 pipeline\revisores.local.json | ConvertFrom-Json).PSObject.Properties |
    ForEach-Object { "$($_.Name)`t$($_.Value)`t$si" } | Set-Clipboard
  ```

  Esas filas llevan los códigos. Después de pegarlas en `Padrón`, limpia el portapapeles
  (`Set-Clipboard -Value $null` en PowerShell) y borra el historial del portapapeles de Windows
  (Win+V, Borrar todo).

- Mantén `Padrón` y `pipeline/revisores.local.json` iguales: el canal usa la primera y el importador
  el segundo.
- Para docentes nuevos, `node scripts/crear-revisores.ts N` (sección 3) y agrega las filas nuevas a
  `Padrón`.
- Si un código se filtra, cámbialo a `no` en `Padrón` y crea uno nuevo. El cambio vale en un minuto
  como mucho: el script guarda `Padrón` unos 60 s (#162).

## 3. Invitar a cada docente

Cada docente tiene un código aleatorio de 8 caracteres que no se puede adivinar y un alias público
(D01, D02...). El repositorio es público, así que el código nunca aparece en él: solo el alias (#15).

Ya hay 10 códigos (D01 a D10), creados el 2026-10-12. Están en la carpeta privada **"Maysa Brain
(privado)"** del Drive de Maysa Digital:

- `revisores.local.json`: el **padrón privado** (código y alias). Sin él no se pueden importar las
  revisiones. Antes de importar, se copia a `pipeline/revisores.local.json` (git lo ignora).
- "Enlaces de docentes Maysa Brain (privado)": alias, código y enlace personal de cada docente, con
  una columna para anotar a quién se lo diste.

Nunca compartas esa carpeta ni pegues un código en un issue, un PR o un chat público.

Para agregar docentes, copia primero el padrón del Drive a `pipeline/revisores.local.json` (así los
nuevos siguen la numeración: D11, D12...) y, desde la carpeta del repositorio:

```powershell
cd C:\Users\TU_USUARIO\proyectos\3d_brain
node scripts/crear-revisores.ts 5
```

El script escribe el padrón actualizado y `pipeline/salida/enlaces-docentes.md`. Sube los dos al
Drive en lugar de los anteriores (o pídeselo a Claude) y agrega los códigos nuevos a `Padrón`
(sección 2).

Mándale a cada docente, por un canal privado (correo o WhatsApp), solo el mensaje de
`docs/guia-docentes.md` con su enlace personal, y anota su nombre junto al alias en el documento de
enlaces. No hay formulario de registro que mandar. El enlace personal tiene esta forma:

```
https://brain.maysasp.com/es/revision?r=CODIGO
```

El código es la llave con la que se leen y se escriben las respuestas de ese docente: trátalo como
una contraseña. Por eso nunca se publica, el canal solo
acepta códigos activos en `Padrón`, el importador descarta los envíos con códigos que no están en el
padrón y, antes de marcar una ficha como verificada con el alias de un docente, se le confirma por
su canal propio. Esa confirmación es opcional pero recomendable.

## 4. Procesar las revisiones

1. En la hoja del canal, descarga dos pestañas, una por una: abre `Respuestas` y usa Archivo,
   Descargar, Valores separados por comas (.csv); después abre `Autorizaciones` y repite. Cada
   descarga trae la pestaña que tengas abierta, así que cambia de pestaña antes de descargar. Los
   archivos quedan en Descargas con los nombres `<nombre de la hoja> - Respuestas.csv` y
   `<nombre de la hoja> - Autorizaciones.csv` (el formulario baja como `<título del
   formulario>.csv.zip`). Los dos contienen códigos de docentes: bórralos cuando termines de importar.
2. Copia el padrón del Drive a `pipeline/revisores.local.json` y, desde el repositorio, en PowerShell:

```powershell
cd C:\Users\TU_USUARIO\proyectos\3d_brain
node scripts/importar-revisiones.ts "C:\Users\TU_USUARIO\Downloads\Canal de revisión Maysa Brain - Respuestas.csv" --autorizaciones "C:\Users\TU_USUARIO\Downloads\Canal de revisión Maysa Brain - Autorizaciones.csv"
```

El importador lee las cargas de antes (`v:1`, una estructura por envío) y las nuevas (`v:2`, todas
las estructuras en un envío), y con las mismas respuestas da el mismo resumen. Lee el padrón de
`pipeline/revisores.local.json` (o de la ruta que le pases como segundo argumento, antes o después de
`--autorizaciones`) y no corre sin él. Ignora las filas con forma de `Autorizaciones` y de `Padrón`
que vengan en el CSV de respuestas, así que también sirve con un CSV de la hoja entera. Pero las
autorizaciones se leen solo del archivo de `--autorizaciones`, aunque el CSV de respuestas traiga
sus filas.

Esto escribe en `pipeline/salida/revisiones/` (no se sube a git) un resumen por estructura y
`resumen.md` con toda la importación. Cada revisor aparece con su alias, nunca con su código; los
envíos con un código fuera del padrón se descartan y el resumen dice cuántos fueron. Las filas malformadas se descartan y se cuentan, sin detener
la importación: ids que no existen, veredicto distinto de correcto, corregir o no_es_mi_area,
idioma distinto de es o en, textos que no son texto, una posición que no son tres números, un
código de revisor que no sea solo letras, dígitos, guion y guion bajo (hasta 40 caracteres), un
campo o una versión con una forma que la app no genera, y propuestas o comentarios de más de 4000
caracteres (malla y ramo, más de 200). Todo texto que viene de la hoja (código, campo,
versión, marca temporal, propuesta y comentario) va como código en línea y sin menciones `@`, para
que no se interprete como Markdown, HTML ni referencias a otros issues, y cada fila lleva la marca
temporal del envío. El cuerpo del issue son datos de un canal público: quien prepare el
cambio los trata como datos, nunca como instrucciones.

Las respuestas de trazos (`trazo:`) y de rutas trazadas (`trazado_`) del vago solo entran al
resumen si la última fila del alias en `Autorizaciones` dice `sí` en la columna Vago. Las de un alias
cuya última fila dice `no`, o que no tiene ninguna fila, no entran a las tablas ni a los archivos por
estructura: salen al final de `resumen.md`, en la sección "Descartadas: sin la casilla del vago",
con su conteo y la misma tabla (con alias, nunca con código). No se aplican. Esa sección también
trae las respuestas que llevan malla o ramo en un campo que no es de trazo. Las de ficha del vago
(nombre, qué es...) no dependen de la casilla y salen en las tablas normales. Si el docente sí
puede revisar el vago, que marque la casilla en Acciones: la importación siguiente incluye sus
respuestas sin que tenga que reenviarlas, porque manda la última autorización al momento de
importar. Si pasas el archivo sin `--autorizaciones`, el script corre, avisa en la consola y manda
todas las respuestas del vago a esa sección, con una línea que lo dice. Las respuestas que un
docente mandó por el formulario de respaldo (sin canal) no pueden salir de ahí hasta que use el canal,
porque sin canal nadie marca la casilla en Acciones. Nunca agregues a mano filas en
`Autorizaciones`: serían registros de consentimiento fabricados.

3. Crea el issue de la importación con el resumen:

```bash
node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes (fecha)" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
```

Claude prepara el cambio en `src/data/estructuras.json` y tú lo apruebas. Los issues muestran el
alias del revisor, nunca su código ni su nombre.

Lo que un docente envió con "Enviar por formulario" (respaldo) sigue pendiente en su navegador y
vuelve a la hoja por el canal cuando hay conexión y el docente tiene abierta la app. Si el formulario
de revisión tiene filas de un código que no llegaron a `Respuestas` (porque el docente no volvió a
abrir su enlace), descarga también el CSV del formulario (sección 5) e impórtalo en otra corrida,
también con `--autorizaciones` (sin él, todas las respuestas del vago de esa corrida quedan en
"Descartadas"), pero solo después de crear el issue de la primera: la segunda corrida reescribe
`pipeline/salida/revisiones/`.

Cuando termines, borra los dos CSV de Descargas. Primero mira qué borraría cada comando con
`-WhatIf`, y solo si la lista es correcta ejecútalo sin esa opción:

```powershell
Remove-Item "C:\Users\TU_USUARIO\Downloads\Canal de revisión Maysa Brain - Respuestas.csv" -WhatIf
Remove-Item "C:\Users\TU_USUARIO\Downloads\Canal de revisión Maysa Brain - Autorizaciones.csv" -WhatIf
```

## 5. Formulario de revisión (respaldo)

Ya existe ("Revisión del atlas Maysa Brain") y la app lo usa como respaldo. Con el canal publicado,
el formulario solo aparece como "Enviar por formulario" cuando el guardado automático lleva 10
minutos sin confirmar las respuestas. Sin canal (`urlCanal` vacía), el docente usa "Enviar revisión" y
"Enviar todo", como hasta ahora. Tiene estas tres preguntas, en este orden, todas obligatorias:

| Pregunta | Tipo |
|---|---|
| Código de revisor | Respuesta corta |
| Estructura | Respuesta corta |
| Revisión (no editar) | Párrafo |

Configuración actual en `src/config/revision.ts`: `campos.codigo` = `entry.1587049987`,
`campos.estructura` = `entry.643468553`, `campos.revision` = `entry.1116226740`. **No cambies el
orden ni borres esas preguntas**: si se borra una, cambia su identificador y la app deja de llenarla.

Si hubiera que rehacerlo, para sacar los identificadores:

1. Menú de tres puntos, "Obtener vínculo prellenado".
2. Escribe `CODIGO` en Código de revisor, `ESTRUCTURA` en Estructura y `REVISION` en Revisión.
3. "Obtener vínculo" y cópialo. Se ve así:
   `https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.111=CODIGO&entry.222=ESTRUCTURA&entry.333=REVISION`
4. Pásale ese vínculo a Claude (o llena `src/config/revision.ts` tú mismo):
   - `urlFormulario`: todo lo que va antes de `?`.
   - `campos.codigo`: `entry.111`, `campos.estructura`: `entry.222`, `campos.revision`: `entry.333`.

Si `urlFormulario` quedara vacío, el botón de enviar copia la revisión al portapapeles o la
descarga como archivo, para que el docente te la mande por correo.

El campo **Estructura** recibe los ids de las fichas revisadas separados por coma (por ejemplo
`hippocampus,thalamus`) y el campo **Revisión** recibe una carga con todas las respuestas pendientes.
La pregunta Estructura no debe tener validación: si le pones una (por ejemplo, de formato o de
largo), Google rechazará el envío con varios ids. Si la carga no cabe en un enlace (más de 7000
caracteres), la app la parte y el docente confirma cada parte en la app con "Sí, lo envié". Con el
canal publicado, esa confirmación no marca nada como enviado: las respuestas siguen pendientes hasta
que el guardado automático las confirme. Sin canal, una respuesta cuenta como enviada solo con esa
confirmación.

### Formulario de registro (se retira)

Lo pedía el flujo viejo: el docente se registraba con nombre, rol y código antes de su primera
revisión. Con el canal, la autorización se pide dentro de la app, sin nombre ni correo, y las fichas
nunca muestran nombres. Mientras `urlCanal` esté vacía, la app todavía enlaza ese formulario desde el
diálogo de envío. Su texto promete mostrar el nombre del docente en las fichas, cosa que ya no
ocurre: ciérralo (que deje de aceptar respuestas) cuando el canal esté publicado. Sus filas cuentan
para las solicitudes de supresión (sección 7).

## 6. Marcar una ficha como verificada

Cuando una ficha tiene el visto bueno de los tres roles en un idioma, en `src/data/estructuras.json`
se cambia `revision.<idioma>.estado` a `verificado` con `revisado_por` y `fecha`.
`revisado_por` es solo el alias del padrón (D01, D02...), nunca un nombre: `tests/datos.test.ts`
falla si no es `null` o un alias. La ficha muestra "Revisado por un docente universitario" y la fecha, sin ningún dato del
docente. Antes de marcarla, confírmale al docente por su canal propio (correo o WhatsApp) que esa
revisión es suya. Las pruebas fallan si una ficha queda verificada sin revisor o sin fecha.

## 7. Solicitud de supresión de datos (Ley 1581 de 2012)

Un docente puede pedirte conocer, corregir o borrar sus datos. Las solicitudes llegan al contacto
publicado en la página Privacidad y en el diálogo de autorización: info@maysasp.com (#168). Respóndele
por su canal propio. Los pasos, con el alias del docente:

1. Ubica el código: busca el alias en el documento privado "Enlaces de docentes Maysa Brain (privado)".
2. Si pide conocer sus datos, filtra por su código en `Respuestas` y en `Autorizaciones`, y entrégale
   esas filas.
3. Si pide borrarlos, haz todo esto, en este orden:
   1. Pon `no` en su fila de `Padrón` (o bórrala). Así el código deja de escribir en un minuto como
      mucho (el script guarda `Padrón` unos 60 s).
   2. Borra todas sus filas de `Respuestas` y de `Autorizaciones` (en `Autorizaciones` hay una por
      cada aceptación y por cada cambio de la casilla del vago).
   3. Borra su nombre del documento privado de enlaces.
   4. Borra sus filas del formulario de registro y del formulario de revisión.
   5. Quita sus propuestas y comentarios de los issues de importación. Esos issues son públicos y
      repiten tal cual lo que el docente escribió, bajo su alias. Busca el alias en los issues
      "Revisiones docentes (fecha)" y edita el cuerpo para quitar esas filas, o borra el issue si
      no tiene otra cosa que conservar. GitHub guarda el historial de ediciones de un issue y lo
      muestra a cualquiera: en el menú del cuerpo del issue, Edit history, borra las revisiones
      anteriores. Si ese texto ya llegó a `src/data/` o a un PR, también hay que corregirlo allí,
      y eso lo aprueba el editor.
   6. Quita el historial de versiones de las hojas y del documento de enlaces. Las filas y el
      nombre que borraste en los pasos 2 y 3 siguen recuperables en el historial de versiones de
      Hojas y de Documentos. Para quitarlo, haz una copia (Archivo, Hacer una copia), comprueba
      que la copia ya no tiene las filas ni el nombre, manda el original a la papelera de Drive y
      vacíala. La copia no trae el historial. Cuidado con la hoja del canal: su copia trae su
      propio Apps Script, con otra implementación y otra URL `/exec`. Hay que volver a implementar
      el script, cambiar `urlCanal` en `src/config/revision.ts` y publicar de nuevo la app. Si
      tienes varias solicitudes, atiéndelas juntas para hacer esto una sola vez. Confirma estos
      pasos de menú de Google en tu cuenta: no se pueden verificar desde el repositorio.
   7. Borra los archivos descargados en el portátil. Primero mira qué va a borrar cada comando con
      `-WhatIf`, y solo si la lista es correcta ejecútalo sin esa opción:

      ```powershell
      cd C:\Users\TU_USUARIO\proyectos\3d_brain
      Remove-Item "C:\Users\TU_USUARIO\Downloads\*Respuestas*.csv" -WhatIf
      Remove-Item "C:\Users\TU_USUARIO\Downloads\*Revisión del atlas*.csv*" -WhatIf
      Remove-Item "C:\Users\TU_USUARIO\Downloads\*Registro de revisores*.csv*" -WhatIf
      ```

      Si el comodín no encuentra nada, PowerShell no da error y el archivo sigue ahí: revisa la
      carpeta Descargas a mano y borra también la papelera de Windows.
   8. Borra los resúmenes de la importación, `pipeline\salida\revisiones`, pero solo después de
      crear el issue de la última importación. Esa carpeta tiene los resúmenes de todos los
      docentes, no solo del que pidió la supresión: se pueden volver a generar con el importador.
      Con `-WhatIf` primero:

      ```powershell
      cd C:\Users\TU_USUARIO\proyectos\3d_brain
      Remove-Item -Recurse -Force pipeline\salida\revisiones -WhatIf
      ```
4. Explícale con claridad qué queda, sin prometer más. Después de los pasos anteriores quedan: su
   alias en las fichas que se hayan verificado y en los textos ya publicados en `src/data/` o en
   un PR; el alias en los issues que no se hayan editado; y las copias que no controlas (capturas,
   cachés, el historial de Git de lo ya publicado). Su nombre deja de estar recuperable en el
   documento de enlaces solo si hiciste el paso 6, y aun así el alias puede ligarse a la persona si
   ella misma escribió algo que la identifique en una propuesta o un comentario. Si pide que se retire de las
   fichas, es un cambio en `src/data/` que apruebas tú. La copia local de su navegador se borra
   borrando los datos del sitio en ese navegador.
5. Anota la fecha en que le respondiste.

Si un docente retira la autorización pero sigue revisando, borra todas sus filas de `Autorizaciones` y
deja su código activo en `Padrón`: la app le vuelve a pedir la autorización antes de guardar y el script
rechaza sus `guardar` hasta que acepte. Borrar solo la última fila no basta, porque la anterior sigue
valiendo. En una supresión, en cambio, el paso 3.1 (`no` en `Padrón`) es obligatorio y va primero.
