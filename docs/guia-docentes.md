# Mensaje para cada docente

La guía de revisión vive dentro de la web: se abre sola la primera vez que el docente entra con su
enlace y queda en el botón **Cómo revisar**. Las dudas abiertas están dentro de cada ficha y
**Qué revisar** ordena el trabajo. Al docente solo hay que mandarle esto (correo o WhatsApp),
cambiando el código por el suyo:

---

Hola, [nombre]. Gracias por ayudarnos a revisar Maysa Brain, un atlas 3D gratuito del cerebro y el
nervio vago para estudiantes de psicología y ciencias de la salud.

Tu enlace personal (no lo compartas: es la llave de tu revisión):
https://brain.maysasp.com/es/revision?r=TU_CODIGO

Al abrirlo verás una guía corta. La primera vez que marques una respuesta, el atlas te pide una sola
vez tu autorización, sin nombre ni correo. Todo se guarda solo y no hay que enviar nada. Para seguir
en otro equipo, abre el mismo enlace. El botón "Qué revisar" te muestra por dónde empezar: primero las
preguntas que más necesitan tu criterio.

Si usas un computador compartido, al terminar sal con "Salir del modo revisión" marcando "Borrar también de
este equipo". Eso no borra tu enlace del historial del navegador (incluidas las páginas del formulario de
Google), ni los archivos de revisión que hayas descargado en Descargas, ni el portapapeles: bórralos tú y
vacía el portapapeles o copia otra cosa. Una ventana privada sirve para revisar, pero tampoco borra las
descargas ni el portapapeles.

Funciona en computador, tableta y celular; para revisar con calma, mejor computador o tableta.

---

Notas para el editor:
- El canal está conectado desde T13 (#99): `urlCanal` está llena en `src/config/revision.ts`. Manda
  este mensaje solo cuando el sitio publicado ya tenga ese cambio y la prueba en ventana de incógnito,
  con un código de prueba, haya dado "Guardado ✓": si el canal no responde, el docente vería pasos
  que este mensaje no explica. Los pasos de montaje están en `docs/revision-docente.md`.
- Los códigos de los docentes están en la pestaña `Padrón` de la hoja del canal; el enlace de cada uno lo
  muestra el menú "Maysa Brain" de esa hoja al crearlo. Nunca van aquí.
- Cada código debe estar activo (`sí`) en la pestaña `Padrón` de la hoja del canal; si no, la app le
  dice al docente que escriba al editor.
- Si un enlace se filtra, el código viejo pasa a `no` en `Padrón` y se crea uno nuevo
  (`docs/revision-docente.md`).
