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

| # | Qué se comprueba | Escaneado (`npm test`) | Borrador (`generar-ramas-vago.py --borrador`) | Publicado (`rutas-vago.json` y tronco recortado) |
|---|---|---|---|---|
| 1 | Recurrente derecho bajo la subclavia derecha | no aplica (ruta trazada) | pasa: 5,6 mm por debajo y sube 51,2 mm | pasa: 3,3 mm por debajo de la subclavia derecha y sube 44,7 mm (el paso pasa por la subclavia junto al origen de la carótida común derecha, `punto: cerca_de`; el punto más bajo de toda la malla de la subclavia es su extremo lateral, a casi 8 cm de la línea media, lejos del vago) |
| 2 | Recurrente izquierdo rodea el arco junto al ligamento | no aplica (ruta trazada) | pasa: 13,3 mm por debajo del arco, sube 87,6 mm, a 13,1 mm del ganglio del ligamento | pasa: 15,2 mm por debajo del arco aórtico, sube 95,9 mm, a 30,8 mm del ganglio del ligamento arterioso (el asa baja por detrás y por debajo del arco, hasta y = 1362,5 mm; el límite de la prueba es el radio del arco más 25 mm, 37,5 mm) |
| 3 | Vago izquierdo delante del arco y detrás del bronquio izquierdo | no aplica (necesita la ruta distal) | falla: cruza el arco 0,5 mm "por detrás"; sí pasa detrás del bronquio izquierdo | pasa: cruza el arco 2,8 mm por delante; pasa por detrás del bronquio principal izquierdo (antes del despeje cruzaba 34,1 mm por delante, 30 mm adelante de la tráquea y atravesando la carótida común izquierda y el bronquio) |
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

Ninguna de las dos se arreglaba en `rutas-vago.yaml`: el YAML solo gobierna lo trazado, y lo que fallaba era el tronco escaneado por encima de la bifurcación de la tráquea. El ADR 0010 reemplaza ese tramo: el GLB ya no publica el escaneado dentro de la banda y la prueba mide el tronco publicado (escaneado fuera de la banda más las rutas torácicas), con lo que las cuatro asimetrías pasan sin cambiar los pasos del YAML.

## Tramo torácico reemplazado (ADR 0010)

Las bandas salen de `public/modelos/rutas-vago.json` (campo `reemplaza`) y se miden con los anclajes de este documento, sin números escritos a mano. `extraer.py` corta de `l#t02` y `r#t02` (y de sus mallas `#toque`) lo que cae dentro de la banda de su lado:

| Lado | De (y_max) | A (y_min) |
|---|---|---|
| Derecho | 1421,1 mm: lo más alto de `Right subclavian artery` | 1348,2 mm: lo más bajo de `Right main bronchus` |
| Izquierdo | 1424,8 mm: lo más alto de `Left subclavian artery` | hasta el final del tronco escaneado (`y_min` nulo); lo que sigue lo traza `vago_izquierdo_distal` |

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

`m-thoracic-cardiac-branches-of-vagus-nerve` queda a menos de 1 mm del tramo escaneado que ya no se publica, así que ahora flota donde no hay vago: se vuelve a ubicar sobre el tramo trazado en una tarea aparte (`reglas-marcadores.yaml` ya lo prevé). Los demás de la tabla están a 5 mm o más del tronco retirado, salvo el cervical superior (0,4 mm, en el borde de la banda izquierda). Esta medición solo se reporta: no mueve ningún marcador ni corta ningún otro trazo.

## Despeje: las rutas no pasan por dentro de un órgano

Una auditoría ciega encontró que las rutas publicadas atravesaban órganos: los dos recurrentes subían por dentro de la tráquea, el esófago y el cricoides y se juntaban en la línea media (3,35 mm entre ellos); el recurrente izquierdo cruzaba la luz del arco; el torácico izquierdo hacía un bucle de 30 mm por delante de la tráquea a través de la carótida común y del bronquio izquierdo; el torácico derecho tocaba el esófago. Las causas, medidas en `anclajes-vago.json`:

1. `surco` era un solo punto a la altura de la cima de la tráquea. Esa franja es una lámina de 0,03 mm de alto (y de 1460,539 a 1460,566 mm, x de −2,0 a 1,5 mm) y el punto salía casi en la línea media, así que la curva cortaba en diagonal la mitad de la tráquea.
2. El último control del surco quedaba más arriba que el del cricoides, y la curva subía a la línea media y volvía a bajar.
3. `rodear: anterior` del arco usaba la franja de 1382,5 mm, que abarca las dos ramas del arco (z de −33,7 a 32,7 mm): "delante" quedaba delante de la aorta ascendente (z = 33,4 mm).
4. El control `rodear: posterior` del bronquio derecho caía 0,79 mm dentro de la caja del esófago, porque bronquio y esófago se tocan ahí.

Qué cambió en `generar-ramas-vago.py` (el YAML conserva sus pasos, salvo `surco`, que ahora recorre el tramo entre dos pasos):

- Las franjas de menos de 1 mm de alto se ignoran (`corte`, `mas_alto`, `mas_bajo`).
- `surco` da un punto cada 5 mm en el orden del nervio; cada punto es el sitio libre más cercano al costado de la tráquea, buscado en una rejilla de 0,5 mm.
- `rodear anterior/posterior` sobre un tubo cuya franja abarca dos ramas parte de la línea central más el radio, proyectado perpendicular al eje del tubo. Con el arco, el control de la ruta torácica izquierda pasa de (31,7; 1384,4; 33,4) a (31,0; 1384,5; 2,2) mm.
- Dos cambios que la plan no decía, hechos al ver los datos reales: (a) el control que devuelve `rodear` se empuja fuera de cualquier órgano vecino en el que haya caído (`_empujar`); sin eso el control del bronquio derecho quedaba 0,79 mm dentro del esófago y pasó a x = −8,9 mm; (b) los anclajes medidos por cajas (tráquea, esófago, cricoides, tiroides) nunca usan la regla de la línea central, porque el esófago es una curva de radio 2,3 mm pero sus franjas miden unos 18 por 10 mm, y con la regla literal habría cambiado el tramo distal.
- `despejar` saca de los órganos los puntos de la curva (sin mover los controles) y parte por la mitad todo tramo que el empuje estiró a más de 2,5 mm. Si algún punto sigue más adentro que su tolerancia, el tramo entre los dos controles que lo contienen se rehace por un camino libre (A* sobre una rejilla de 0,5 mm en x y z y de 1 mm en y; hasta 3 veces). Si no hay camino, el generador lanza `Atraviesa` nombrando ruta, órgano y altura, y no escribe nada. Este camino solo se usó en el recurrente izquierdo, entre el asa y el surco: la curva directa pasa por una estrechez entre la esquina de la tráquea, la cara del esófago y el arco, y el camino libre baja por debajo del arco (hasta y = 1362,5 mm) y sube por detrás.

Modelo de obstáculos (`Modelo.profundidad` y `scripts/lib/despeje.ts`, dos implementaciones independientes): trece órganos. Cajas por franja de altura para la tráquea, el esófago y los cartílagos cricoides y tiroides; donde tráquea y esófago se tocan (la cara posterior de la tráquea queda detrás de la anterior del esófago), las dos caras se mueven a su punto medio. Tubos (línea central y radio) para el arco, la aorta torácica, el tronco braquiocefálico, las dos carótidas comunes, las dos subclavias y los dos bronquios principales. La profundidad es positiva dentro del órgano.

**Tolerancia (decisión del editor, 2026-10-17).** 0,5 mm (el radio del nervio) contra arterias, bronquios y cartílagos. 1 mm (dos radios) solo contra la tráquea y el esófago: el recurrente va en el surco traqueoesofágico, en contacto con sus paredes. El modelo de cajas es conservador en las esquinas y no equivale a una prueba de rayos sobre el GLB. Lo que se vigila: ningún punto de ninguna ruta, ni los puntos medios entre dos puntos seguidos, queda más adentro que esa tolerancia.

Profundidad máxima por ruta y obstáculo, en mm (positiva = dentro) y la altura en que ocurre. Solo se listan los obstáculos a menos de 3 mm de la ruta:

| Ruta | Obstáculo | Máxima (mm) | y (mm) |
|---|---|---|---|
| Torácico derecho | Tráquea | −0,37 | 1368,7 |
| Torácico derecho | Esófago | −0,21 | 1355,9 |
| Torácico derecho | Bronquio principal derecho | −0,79 | 1362,8 |
| Torácico izquierdo | Arco aórtico | −0,75 | 1382,5 |
| Torácico izquierdo | Aorta torácica | −2,38 | 1344,3 |
| Torácico izquierdo | Subclavia izquierda | −2,54 | 1410,1 |
| Torácico izquierdo | Carótida común izquierda | −3,02 | 1417,4 |
| Torácico izquierdo | Bronquio principal izquierdo | −0,75 | 1346,2 |
| Recurrente derecho | Tráquea | −0,75 | 1422,1 |
| Recurrente derecho | Esófago | −2,99 | 1458,4 |
| Recurrente derecho | Cricoides | −0,59 | 1457,7 |
| Recurrente derecho | Subclavia derecha | −0,75 | 1413,8 |
| Recurrente izquierdo | Tráquea | +0,75 | 1367,1 |
| Recurrente izquierdo | Esófago | +0,50 | 1370,7 |
| Recurrente izquierdo | Cricoides | −0,03 | 1457,5 |
| Recurrente izquierdo | Arco aórtico | −0,01 | 1367,7 |
| Recurrente izquierdo | Carótida común izquierda | −2,95 | 1447,6 |
| Recurrente izquierdo | Bronquio principal izquierdo | −0,59 | 1362,7 |
| Vago izquierdo distal | Esófago | −0,05 | 1338,0 |
| Vago izquierdo distal | Aorta torácica | −2,38 | 1344,3 |
| Vago izquierdo distal | Bronquio principal izquierdo | −1,38 | 1344,3 |

Las dos únicas profundidades positivas están dentro de la tolerancia de 1 mm: el recurrente izquierdo contra la tráquea y contra el esófago, en la estrechez del arco.

Otras medidas del resultado publicado:

- Separación mínima entre los dos recurrentes: 23,0 mm (antes 3,35 mm); la prueba exige 15 mm o más.
- El asa del recurrente derecho: punto más bajo en x = −26,1, y = 1413,8, z = 0,5 mm, a 11,7 mm en planta del vago derecho publicado a esa altura (la prueba exige 20 mm o menos).
- Rango de x de cada ruta, en mm: torácico derecho −16,6 a −6,1; torácico izquierdo 16,5 a 31,0; recurrente derecho −26,2 a −11,4; recurrente izquierdo 6,3 a 30,9; vago izquierdo distal −0,2 a 19,1.
- Las bandas `reemplaza`, `atlas.glb`, `pipeline/cajas.json` y `pipeline/anclajes-vago.json` no cambiaron.

Limitaciones: la estrechez del recurrente izquierdo (la tráquea, el esófago y el arco están pegados en el modelo) es lo más ajustado; las rutas siguen en `en_revision`, y es un docente quien juzga si el recorrido por debajo y por detrás del arco es el correcto.

## Propuestas de `candidato()` que cambiaron

La versión anterior medía la distancia al centro de la caja de cada anclaje. Con órganos grandes eso engaña: el centro de la caja del diafragma quedaba más cerca que el del estómago, y t12 y t13 del lado derecho salían "sin candidato" aunque terminan unos 88 y 94 mm debajo del final del esófago y la superficie más cercana es la del estómago (17 y 24 mm). Ahora mide contra la superficie real (vértices con modificadores) y aplica una regla explícita: si el extremo inferior queda debajo del final de la línea central del esófago y a menos de 15 mm de la superficie del estómago, propone ramo abdominal. Siguen sin candidato t00 de cada lado (termina a 3 o 4 mm de la carótida común, a la altura del cricoides) y r#t14 (termina a 8 mm del diafragma y a 30 mm del estómago, cerca de la línea media).
