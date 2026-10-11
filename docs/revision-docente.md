# Revisión docente (F24): cómo ponerla a andar

La app no tiene servidor. Las revisiones de los docentes llegan a un formulario de Google tuyo y de
ahí a una hoja de cálculo. Se configura una sola vez (unos 10 minutos).

## 1. Crear el formulario

En https://forms.google.com crea un formulario nuevo, por ejemplo "Revisión del atlas", con estas
preguntas en este orden:

| Pregunta | Tipo | Obligatoria |
|---|---|---|
| Código de revisor | Respuesta corta | Sí |
| Estructura | Respuesta corta | Sí |
| Revisión (no editar) | Párrafo | Sí |
| Nombre completo | Respuesta corta | Sí |
| Rol | Opción múltiple: Neuroanatomía, Psicología, Traducción | Sí |
| Autorizo que mi nombre aparezca como revisor en las fichas que valide (Ley 1581 de 2012) | Casillas: "Autorizo" | Sí |

En Configuración, desactiva "Recopilar correos electrónicos" si no los necesitas: menos datos
personales, menos obligaciones.

## 2. Sacar los identificadores

1. Menú de tres puntos, "Obtener vínculo prellenado".
2. Escribe `CODIGO` en Código de revisor, `ESTRUCTURA` en Estructura y `REVISION` en Revisión.
3. "Obtener vínculo" y cópialo. Se ve así:
   `https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.111=CODIGO&entry.222=ESTRUCTURA&entry.333=REVISION`
4. Pásale ese vínculo a Claude (o llena `src/config/revision.ts` tú mismo):
   - `urlFormulario`: todo lo que va antes de `?`.
   - `campos.codigo`: `entry.111`, `campos.estructura`: `entry.222`, `campos.revision`: `entry.333`.

Mientras no esté configurado, el botón de enviar copia la revisión al portapapeles o la descarga
como archivo, para que el docente te la mande por correo.

## 3. Invitar a cada docente

Asigna a cada docente un código corto (por ejemplo `ANAT01`, `PSI01`, `TRAD01`) y mándale su enlace:

```
https://ragarciaga.github.io/3d_brain/es/revision?r=ANAT01
```

El código solo sirve para saber de quién es la revisión; no es una contraseña. Lleva tú la lista
de códigos y nombres (no la subas al repositorio).

## 4. Procesar las revisiones

1. En la hoja de respuestas: Archivo, Descargar, CSV.
2. Desde el repositorio:

```bash
node scripts/importar-revisiones.ts respuestas.csv
```

En Windows (PowerShell), con la ruta donde quedó el archivo:

```powershell
node scripts/importar-revisiones.ts "C:\Users\TU_USUARIO\Downloads\Revisión del atlas.csv"
```

Esto escribe un resumen por estructura en `pipeline/salida/revisiones/` (no se sube a git). Cada
resumen se vuelve un issue con la etiqueta `rb:needs-human`; Claude prepara el cambio y tú lo
apruebas. Los issues muestran el código del revisor, nunca su nombre.

## 5. Marcar una ficha como verificada

Cuando una ficha tiene el visto bueno de los tres roles en un idioma, en `src/data/estructuras.json`
se cambia `revision.<idioma>.estado` a `verificado` con `revisado_por` y `fecha`. Las pruebas
fallan si una ficha queda verificada sin revisor o sin fecha.
