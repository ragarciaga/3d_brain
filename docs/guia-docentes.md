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

Funciona en computador, tableta y celular; para revisar con calma, mejor computador o tableta.

---

Notas para el editor:
- El canal está conectado desde T13 (#99): `urlCanal` está llena en `src/config/revision.ts`. Manda
  este mensaje solo cuando el sitio publicado ya tenga ese cambio y la prueba en ventana de incógnito,
  con un código de prueba, haya dado "Guardado ✓": si el canal no responde, el docente vería pasos
  que este mensaje no explica. Los pasos de montaje están en `docs/revision-docente.md`.
- Los códigos y enlaces de cada docente están en la carpeta privada del Drive, nunca aquí.
- Cada código debe estar activo (`sí`) en la pestaña `Padrón` de la hoja del canal; si no, la app le
  dice al docente que escriba al editor.
- Si un enlace se filtra, el código viejo pasa a `no` en `Padrón` y se crea uno nuevo
  (`docs/revision-docente.md`).
