# Auditoría del vago (ADR 0009)

Propuestas para revisión docente: ningún nombre es definitivo.

## Anclajes

| Anclaje | Estado | Tipo |
|---|---|---|
| Medulla oblongata.l | presente | MESH |
| Medulla oblongata.r | presente | MESH |
| Olive.l | presente | MESH |
| Olive.r | presente | MESH |
| Internal jugular vein.l | presente | CURVE |
| Internal jugular vein.r | presente | CURVE |
| Laryngopharynx | presente | MESH |
| Thyroid cartilage | presente | MESH |
| Cricoid cartilage | presente | MESH |
| Trachea | presente | MESH |
| Oesophagus | presente | CURVE |
| Right subclavian artery | presente | CURVE |
| Left subclavian artery | presente | CURVE |
| Right common carotid artery | presente | CURVE |
| Left common carotid artery | presente | CURVE |
| Brachiocephalic trunk | presente | CURVE |
| Aortic arch | presente | CURVE |
| Thoracic aorta | presente | CURVE |
| Node of ligamentum arteriosum | presente | MESH |
| Left main bronchus | presente | CURVE |
| Right main bronchus | presente | CURVE |
| Diaphragm | presente | MESH |
| Stomach | presente | MESH |
| Liver | presente | MESH |

## Trazos

Altura en mm sobre el origen del modelo (Y arriba). Cercanos: las dos piezas más próximas a cada extremo del trazo (arriba / abajo), a su superficie. Los umbrales de cada regla están en `pipeline/reglas_vago.py` y las fuentes, en `docs/research/marcadores/fuentes.md`.

| Trazo | Altura (mm) | Largo (mm) | Cercanos (arriba / abajo) | Propuesta | Regla | Confianza | Fuente |
|---|---|---|---|---|---|---|---|
| Vagus nerve (X).l#t00 | 1471 a 1455 | 17 | Left common carotid artery 1 mm, Internal jugular vein.l 5 mm / Left common carotid artery 3 mm, Internal jugular vein.l 12 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).l#t01 | 1538 a 1525 | 38 | Internal jugular vein.l 2 mm, Medulla oblongata.l 32 mm / Laryngopharynx 19 mm, Internal jugular vein.l 32 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).l#t02 | 1573 a 1347 | 291 | Olive.l 2 mm, Medulla oblongata.l 6 mm / Thoracic aorta 5 mm, Oesophagus 11 mm | tronco del vago | tronco | alta | In2026 |
| Vagus nerve (X).l#t03 | 1576 a 1572 | 16 | Olive.l 2 mm, Medulla oblongata.l 4 mm / Medulla oblongata.l 4 mm, Olive.l 4 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).l#t04 | 1572 a 1570 | 16 | Medulla oblongata.l 4 mm, Olive.l 4 mm / Olive.l 2 mm, Medulla oblongata.l 6 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).l#t05 | 1572 a 1571 | 15 | Medulla oblongata.l 4 mm, Olive.l 4 mm / Medulla oblongata.l 4 mm, Medulla oblongata.r 4 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).l#t06 | 1572 a 1572 | 6 | Olive.l 2 mm, Medulla oblongata.l 4 mm / Medulla oblongata.l 2 mm, Medulla oblongata.r 2 mm | raicilla (sale del bulbo) | raicilla | baja | Kim2022 |
| Vagus nerve (X).r#t00 | 1471 a 1455 | 17 | Right common carotid artery 1 mm, Internal jugular vein.r 5 mm / Right common carotid artery 4 mm, Internal jugular vein.r 12 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t01 | 1538 a 1525 | 38 | Internal jugular vein.r 2 mm, Medulla oblongata.r 32 mm / Laryngopharynx 19 mm, Internal jugular vein.r 32 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t02 | 1573 a 1128 | 601 | Olive.r 2 mm, Medulla oblongata.r 6 mm / Stomach 5 mm, Diaphragm 31 mm | tronco del vago | tronco | alta | In2026 |
| Vagus nerve (X).r#t03 | 1140 a 1130 | 19 | Stomach 2 mm, Diaphragm 28 mm / Stomach 6 mm, Diaphragm 40 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t04 | 1133 a 1131 | 12 | Stomach 6 mm, Diaphragm 40 mm / Stomach 7 mm, Diaphragm 44 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t05 | 1131 a 1130 | 5 | Stomach 6 mm, Diaphragm 43 mm / Stomach 7 mm, Diaphragm 45 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t06 | 1141 a 1137 | 15 | Stomach 6 mm, Diaphragm 48 mm / Stomach 5 mm, Diaphragm 37 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t07 | 1184 a 1164 | 29 | Stomach 1 mm, Diaphragm 21 mm / Stomach 3 mm, Diaphragm 14 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t08 | 1171 a 1168 | 8 | Stomach 4 mm, Diaphragm 11 mm / Stomach 3 mm, Diaphragm 15 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t09 | 1218 a 1211 | 46 | Stomach 2 mm, Diaphragm 20 mm / Liver 2 mm, Stomach 2 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t10 | 1211 a 1190 | 32 | Stomach 2 mm, Liver 14 mm / Stomach 2 mm, Diaphragm 38 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t11 | 1207 a 1202 | 20 | Stomach 3 mm, Liver 25 mm / Stomach 2 mm, Diaphragm 31 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t12 | 1216 a 1111 | 124 | Liver 2 mm, Stomach 2 mm / Stomach 17 mm, Diaphragm 28 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t13 | 1151 a 1105 | 50 | Stomach 5 mm, Diaphragm 9 mm / Stomach 24 mm, Diaphragm 24 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t14 | 1154 a 1143 | 52 | Diaphragm 7 mm, Stomach 7 mm / Diaphragm 4 mm, Liver 24 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t15 | 1188 a 1150 | 46 | Stomach 2 mm, Diaphragm 6 mm / Stomach 3 mm, Diaphragm 19 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | alta | Guo2024 |
| Vagus nerve (X).r#t16 | 1155 a 1148 | 48 | Stomach 2 mm, Diaphragm 38 mm / Diaphragm 7 mm, Stomach 7 mm | candidato: ramo gástrico posterior | abdominal_gastrico_posterior | media | Guo2024 |
| Vagus nerve (X).r#t17 | 1576 a 1572 | 16 | Olive.r 2 mm, Medulla oblongata.r 4 mm / Medulla oblongata.r 4 mm, Olive.r 4 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t18 | 1572 a 1570 | 16 | Medulla oblongata.r 4 mm, Olive.r 4 mm / Olive.r 2 mm, Medulla oblongata.r 6 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t19 | 1572 a 1571 | 15 | Medulla oblongata.r 4 mm, Olive.r 4 mm / Medulla oblongata.r 4 mm, Medulla oblongata.l 4 mm | sin candidato | sin_regla | - | Bahadir2026 |
| Vagus nerve (X).r#t20 | 1572 a 1572 | 6 | Olive.r 2 mm, Medulla oblongata.r 4 mm / Medulla oblongata.r 2 mm, Medulla oblongata.l 2 mm | raicilla (sale del bulbo) | raicilla | baja | Kim2022 |

## Reglas de la spec 04

Las secciones Anclajes y Trazos salen de la corrida del 17 de octubre de 2026 (Z-Anatomy, commit `9de5d6912a1b0df9cab739d57f00e036b0496ddc`, bpy 5.2.2) con las reglas de la spec 04.
Las reglas viven en `pipeline/reglas_vago.py` y sus fuentes, en `docs/research/marcadores/fuentes.md` (sección "Trazos sin nombre del vago: cómo distinguirlos").
Los umbrales marcados "(derivado)" y la cara decidida por el centro z de la caja no salen de una fuente: el editor los aprueba en este PR.
Cada propuesta es para revisión docente. Si una regla no distingue el trazo, queda `sin_regla`, sin propuesta.
La fecha de "Cómo se generó" y la sección "Propuestas de `candidato()` que cambiaron" describen la corrida y la regla anteriores, no estas tablas.

## Cómo se generó

`pipeline/anclajes-vago.json` ya está en el repo (entró con la implementación del ADR 0010) y se regenera con `python pipeline/auditar-vago.py`. Lo escribe desde el commit fijado de Z-Anatomy y sale idéntico byte a byte en dos corridas seguidas (`cmp`). `auditar-vago.py` lee el .blend, no el GLB: las secciones Anclajes y Trazos no dependen de que el GLB tenga el tronco recortado.

- Modelo: Z-Anatomy, commit `9de5d6912a1b0df9cab739d57f00e036b0496ddc`. `Z-Anatomy.zip` y `TA2.csv` se sacaron de ese commit con git (la descarga directa de GitHub respondía 403) y `pipeline/descargar.py` verificó el SHA-256 de los dos contra `pipeline/comun.py`: coinciden.
- Blender como módulo: bpy 5.2.2 en Python 3.13.
- Primera corrida: 13 de octubre de 2026.
- Corrida de la spec 02 T5: 17 de octubre de 2026, sobre `main` en `381f1ba`, mismo commit de Z-Anatomy, bpy 5.2.2, SHA-256 del zip `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736` y de `TA2.csv` `0f9092a328b27dcd15d696d9f9a4087deb229a1aad21b75876657622de835974`, verificados por `descargar.py`. Orden: `auditar-vago.py`, `generar-ramas-vago.py`, `extraer.py` y `scripts/comprimir-modelo.ts`. Las secciones Anclajes y Trazos de esa corrida son idénticas a las de este documento.

## Anclaje sustituido: ligamento arterioso

Z-Anatomy no trae el ligamento arterioso como objeto (tampoco en `docs/research/fase-0/inventario-z-anatomy.tsv`; el ADR 0009 lo daba por presente). Lo único con ese nombre es `Node of ligamentum arteriosum`, un ganglio linfático mediastínico de 86 vértices. En el modelo está:

- en x = 28,8 mm, y = 1367,6 mm, z = 4,2 mm (lado izquierdo);
- a 20,3 mm del eje del arco aórtico, que tiene radio 12,5 mm: 7,8 mm por debajo de su superficie;
- a 8,5 mm de la superficie de la bifurcación del tronco pulmonar.

Es el sitio del ligamento (entre la concavidad del arco y la bifurcación pulmonar), así que se usa como sustituto topográfico en `auditar-vago.py`, `rutas-vago.yaml` y la asimetría 2. Es otra estructura: lo confirma o lo rechaza un docente.

## Asimetrías

Eje anterior medido: +Z (centro de la tráquea en z = −1,8 mm, del esófago en z = −7,7 mm).

| # | Qué se comprueba | Escaneado (`npm test`) | Borrador (`generar-ramas-vago.py --borrador`) | Con las rutas del borrador y el tronco recortado (no se publica: Plan B) |
|---|---|---|---|---|
| 1 | Recurrente derecho bajo la subclavia derecha | no aplica (ruta trazada) | pasa: 5,6 mm por debajo y sube 51,2 mm | pasa: 5,6 mm por debajo de la subclavia derecha y sube 51,2 mm |
| 2 | Recurrente izquierdo rodea el arco junto al ligamento | no aplica (ruta trazada) | pasa: 13,3 mm por debajo del arco, sube 87,6 mm, a 13,1 mm del ganglio del ligamento | pasa: 13,5 mm por debajo del arco aórtico, sube 87,6 mm, a 14,4 mm del ganglio del ligamento arterioso |
| 3 | Vago izquierdo delante del arco y detrás del bronquio izquierdo | no aplica (necesita la ruta distal) | falla: cruza el arco 0,5 mm "por detrás"; sí pasa detrás del bronquio izquierdo | pasa: cruza el arco 34,1 mm por delante; pasa por detrás del bronquio principal izquierdo |
| 4 | Vago derecho detrás del bronquio derecho y del esófago | falla | falla (es la misma geometría escaneada) | pasa: por detrás del bronquio principal derecho; por detrás del esófago 5 cm sobre su final |

### Por qué fallan la 3 y la 4: el vago del tórax es un espejo

Entre y = 1572 mm (bulbo) y y = 1347 mm (donde termina el izquierdo), el tronco izquierdo y el derecho de Z-Anatomy son el reflejo uno del otro en x: desvío medio 0,05 mm, máximo 3,3 mm (en 1350 mm, donde termina el izquierdo), sobre 226 alturas medidas cada milímetro. El modelo fuente dibujó un vago y lo reflejó, así que no puede tener las asimetrías.

Asimetría 4, vago derecho frente al bronquio principal derecho (franjas de 5 mm):

| y (mm) | Bronquio derecho, z (mm) | Vago derecho, z (mm) |
|---|---|---|
| 1372,5 | −20 a −3 | 0,9 |
| 1367,5 | −21 a −3 | 1,9 |
| 1362,5 | −22 a −5 | 1,7 |
| 1357,5 | −23 a −6 | −2,3 |
| 1352,5 | −24 a −8 | −28,3 |
| 1347,5 | −24 a −9 | −41,7 |

Hasta 1357,5 mm el vago va 4 a 7 mm por delante de la cara anterior del bronquio; en 5 mm de altura salta 26 mm hacia atrás atravesándolo. A la altura del centro del bronquio (1359,6 mm), donde mide la prueba, el vago está 14,4 mm por delante del eje. Debajo sí queda detrás del esófago.

Asimetría 3, vago izquierdo frente al arco aórtico: a la altura de la cima del eje del arco (1384,4 mm) el vago está en x = 18,4 mm, z = −1,2 mm, a 0,7 mm del eje. El arco tiene radio 12,5 mm: el vago escaneado pasa por dentro de la aorta. Entre 1397,5 y 1357,5 mm se mantiene en x = 11 a 18 mm, z = −3 a +2 mm, siempre dentro de la caja del arco.

Ninguna de las dos se arreglaba en `rutas-vago.yaml`: el YAML solo gobierna lo trazado, y lo que fallaba era el tronco escaneado por encima de la bifurcación de la tráquea. El ADR 0010 reemplaza ese tramo: el GLB ya no publica el escaneado dentro de la banda y la prueba mide el tronco publicado (escaneado fuera de la banda más las rutas torácicas), con lo que las cuatro asimetrías pasan sin cambiar los pasos del YAML. Esa última columna es la medición con las rutas de ese borrador; en el lanzamiento docente no se publica ninguna ruta (Plan B, abajo), así que esa columna no describe lo que ve el estudiante.

## Tramo torácico retirado (Plan B)

El 18 de octubre de 2026 el editor decidió que para el lanzamiento docente no se publica ninguna ruta trazada. El tramo escaneado de arriba (el espejo) tampoco se publica, así que en el tórax queda un hueco. Las bandas salen de `public/modelos/rutas-vago.json` (lista `huecos`; antes, el campo `reemplaza` de cada ruta torácica) y se miden con los anclajes de este documento, sin números escritos a mano. `extraer.py` corta de `l#t02` y `r#t02` (y de sus mallas `#toque`) lo que cae dentro de la banda de su lado:

| Lado | De (y_max) | A (y_min) |
|---|---|---|
| Derecho | 1421,1 mm: lo más alto de `Right subclavian artery` | 1348,2 mm: lo más bajo de `Right main bronchus` |
| Izquierdo | 1424,8 mm: lo más alto de `Left subclavian artery` | hasta el final del tronco escaneado (`y_min` nulo); lo que sigue (el vago izquierdo distal) queda pendiente de trazado |

Las alturas de `l#t02` y `r#t02` en la tabla "Trazos" (de 1573 a 1347 mm y de 1573 a 1128 mm) son las del trazo fuente sin cortar: esa tabla sale del .blend. El GLB publica esos dos trazos cortados, con los extremos sobre la banda: el izquierdo termina en la subclavia izquierda y el derecho queda en dos componentes dentro de una sola malla. La caja de `l#t02` pasa de y = 1346,2 a 1573,6 mm a y = 1424,8 a 1573,6 mm (igual en `l#t02#toque`). Las cajas de `r#t02` y `r#t02#toque` no cambian, porque sus dos extremos quedan fuera de la banda. Ninguna otra caja de `pipeline/cajas.json` cambió.

Trazos escaneados distintos de `#t02` con puntos dentro de la banda de su lado: ninguno. `l#t00` y `r#t00` van de 1455 a 1471 mm, por encima de las dos bandas; el resto de los trazos izquierdos y `r#t01`, `r#t17` a `r#t20` quedan entre 1525 y 1576 mm, también por encima, y `r#t03` a `r#t16` entre 1105 y 1216 mm, por debajo de la banda derecha. Los 349 puntos de `l#t02` tienen 72 dentro de la banda izquierda y los 613 de `r#t02` tienen 68 dentro de la derecha.

Marcadores de `src/data/marcadores.json` (26 en total) con una posición dentro de la banda de su lado, y distancia al tramo retirado del tronco:

| Marcador | Lado | y (mm) | Distancia al tronco retirado |
|---|---|---|---|
| `m-superior-cervical-cardiac-branches-of-vagus-nerve` | izquierdo | 1424,2 | 0,4 mm |
| `m-inferior-cervical-cardiac-branches-of-vagus-nerve` | izquierdo / derecho | 1372,6 / 1413,3 | 7,7 / 7,3 mm |
| `m-recurrent-laryngeal-nerve` | izquierdo / derecho | 1372,6 / 1413,3 | 7,7 / 7,3 mm |
| `m-thoracic-cardiac-branches-of-vagus-nerve` | izquierdo / derecho | 1374,3 / 1394,1 | 0,5 / 0,7 mm |
| `m-bronchial-branches-of-vagus-nerve` | izquierdo / derecho | 1325,5 / 1353,7 | 41,5 / 5,8 mm |
| `m-pulmonary-plexus` | izquierdo / derecho | 1325,5 / 1353,7 | 41,5 / 5,8 mm |

`m-thoracic-cardiac-branches-of-vagus-nerve` queda a menos de 1 mm del tramo escaneado que ya no se publica, y su regla lo puso sobre ese tronco espejo (el izquierdo, donde el espejo pasa por dentro del arco aórtico). Como no hay tramo trazado donde ubicarlo, el Plan B lo pasa a `sin_ubicar` (`posicion: null`, con su motivo en `docs/research/marcadores/resumen-propuestas.md`) y se vuelve a ubicar cuando se trace el vago torácico (`reglas-marcadores.yaml` ya lo prevé; si se vuelve a correr `ubicar-marcadores.py`, la regla lo devuelve al tronco espejo). Los demás de la tabla se quedan: el cervical superior izquierdo (0,4 mm, en el borde de la banda izquierda) queda pegado al extremo visible, y el cervical inferior, el recurrente, el bronquial y el plexo pulmonar están a 5,8 mm o más del tronco y los ponen anclajes de órganos; como marcadores (punto con etiqueta, sin volumen) no afirman un recorrido. Esta medición no mueve ningún otro marcador ni corta ningún otro trazo.

## Propuestas de `candidato()` que cambiaron

La versión anterior medía la distancia al centro de la caja de cada anclaje. Con órganos grandes eso engaña: el centro de la caja del diafragma quedaba más cerca que el del estómago, y t12 y t13 del lado derecho salían "sin candidato" aunque terminan unos 88 y 94 mm debajo del final del esófago y la superficie más cercana es la del estómago (17 y 24 mm). Ahora mide contra la superficie real (vértices con modificadores) y aplica una regla explícita: si el extremo inferior queda debajo del final de la línea central del esófago y a menos de 15 mm de la superficie del estómago, propone ramo abdominal. Siguen sin candidato t00 de cada lado (termina a 3 o 4 mm de la carótida común, a la altura del cricoides) y r#t14 (termina a 8 mm del diafragma y a 30 mm del estómago, cerca de la línea media).
