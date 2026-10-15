<!-- rockbuilt:test-report -->
# Informe de pruebas: canal de retorno de la revisión docente

Plan: [test-plan.md](test-plan.md)  |  Comando: `npm run test:e2e`  |  Estado: GREEN

## Corrida 1: 2026-10-15
- Commit: f3a457d  |  Rama: rb/verify-review-return-channel
- Resultado: 27/27 pasan, 0 fallan, 0 inestables (`verificar-canal`, `revision-canal` y `respaldo`: 26 en 7,5 min; `atlas.spec.ts -g "revisado por un docente"`: 1 en 15 s)
- Entorno: app alcanzable sí (servidor de Playwright en el puerto 3210), credenciales no hacen falta (el canal del editor se simula con `page.route` en `canal-prueba.invalid`; `protegerCanalReal()` no registró ninguna salida real), datos los de `src/data/`.

| Caso | Prueba | Resultado | Clase | Criterio |
|---|---|---|---|---|
| F1-H | e2e/revision-canal.spec.ts:35 (es y en) y e2e/respaldo.spec.ts:54 | pasa | | R1.1 |
| F1-E1 | e2e/revision-canal.spec.ts:43, :54, :67, :80 | pasa | | R1.2 |
| F1-E2 | e2e/revision-canal.spec.ts:675, :621 | pasa | | R1.3 |
| F2-H | e2e/revision-canal.spec.ts:301, :411 | pasa | | R2.1, R2.4, R2.6 |
| F2-E1 | e2e/revision-canal.spec.ts:301 | pasa | | R2.2 |
| F2-E2 | e2e/verificar-canal.spec.ts:134 | pasa | | R2.2 |
| F3-H | e2e/revision-canal.spec.ts:552 | pasa | | R3.1, R3.2, R3.7 |
| F3-E1 | e2e/revision-canal.spec.ts:621 | pasa | | R3.5 |
| F3-E2 | e2e/verificar-canal.spec.ts:175 | pasa | | R3.4, R3.7 |
| F4-H | e2e/revision-canal.spec.ts:736 | pasa | | R4.1, R4.4 |
| F4-E1 | e2e/verificar-canal.spec.ts:208 | pasa | | R4.1 (R6.6) |
| F4-E2 | e2e/revision-canal.spec.ts:736 | pasa | | R4.1 |
| F5-H | e2e/revision-canal.spec.ts:1055, :1203 | pasa | | R5.2, R5.3 |
| F5-E1 | e2e/revision-canal.spec.ts:1055 | pasa | | R5.1 |
| F5-E2 | e2e/revision-canal.spec.ts:361, :1055 | pasa | | R5.3 |
| F6-H | e2e/revision-canal.spec.ts:812 | pasa | | R7.1 |
| F6-E1 | e2e/revision-canal.spec.ts:471 | pasa | | R7.2 |
| F6-E2 | e2e/revision-canal.spec.ts:935 | pasa | | R7.1 |
| F7-H | e2e/atlas.spec.ts:359 | pasa | | R9.1, R9.2 |
| F7-E1 | e2e/verificar-canal.spec.ts:256 (es y en) | pasa | | R9.2 |
| F7-E2 | e2e/atlas.spec.ts:359 | pasa | | R9.1 |

### Fallas
Ninguna.

### Aserciones débiles encontradas
- e2e/verificar-canal.spec.ts:134 (F2-E2): las cuentas de `guardar` y `autorizar` en 0 se leían antes de los 3 s de espera del envío; una app que enviara tras cerrar el diálogo pasaría. Endurecer con reloj controlado.
- e2e/verificar-canal.spec.ts:245 (F4-E1): mismo problema con `guardar` en 0.
- e2e/verificar-canal.spec.ts:153 y 170: la lectura única de "Guardado ✓" depende del mismo momento.
- e2e/verificar-canal.spec.ts:257-260 (F7-E1): `innerText()` no ve alias en `title`, `aria-label` ni `alt`.

Ruta: de vuelta al e2e-writer (ronda 1 de 2).

### Cambios desde la corrida anterior
- Primera corrida. El e2e-writer encontró que la suite existente ya cubría 16 de los 21 casos y escribió los 5 que faltaban en `e2e/verificar-canal.spec.ts`.

### Notas
- No hay ninguna ficha verificada en `src/data/`: F7-H y F7-E2 inyectan el estado verificado en memoria (solo funciona con el servidor de desarrollo). Ningún contenido anatómico se inventó.
- El modo revisión de todas las pruebas depende de la costura de desarrollo `__urlCanalInicial`; es intencional (`e2e/canal-real.ts`).
- `e2e/revision-canal.spec.ts` usa esperas fijas negativas (por ejemplo `ESPERA_CANAL_MS + 1000`) con comentario; la referencia de e2e las desaconseja. Queda como seguimiento.
- Observación del e2e-writer: una respuesta del canal con un campo inventado pero con formato válido se acepta y cuenta (R6.6 usa las reglas del importador, que solo validan el formato). No se ve en ninguna ficha. Queda como pregunta para el spec.
