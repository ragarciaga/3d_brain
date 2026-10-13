# Auditoría del vago (ADR 0009)

Propuestas para revisión docente: ningún nombre es definitivo.

## Anclajes

| Anclaje | Estado | Tipo |
|---|---|---|
| Medulla oblongata.l | presente | MESH |
| Medulla oblongata.r | presente | MESH |
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

## Trazos

Altura en mm sobre el origen del modelo (Y arriba). Cercanos: distancia del extremo inferior a la superficie de los dos anclajes más próximos.

| Trazo | Altura (mm) | Largo (mm) | Cercanos | Propuesta | Por qué |
|---|---|---|---|---|---|
| Vagus nerve (X).l#t00 | 1471 a 1455 | 17 | Left common carotid artery 3 mm, Internal jugular vein.l 12 mm | sin candidato | extremo inferior a 3 mm de la superficie de Left common carotid artery |
| Vagus nerve (X).l#t01 | 1538 a 1525 | 38 | Laryngopharynx 19 mm, Internal jugular vein.l 32 mm | candidato: ramo faríngeo | extremo inferior a 19 mm de la superficie de Laryngopharynx |
| Vagus nerve (X).l#t02 | 1573 a 1347 | 291 | Thoracic aorta 5 mm, Oesophagus 11 mm | tronco del vago | el trazo más largo del lado |
| Vagus nerve (X).l#t03 | 1576 a 1572 | 16 | Medulla oblongata.l 4 mm, Internal jugular vein.l 16 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).l#t04 | 1572 a 1569 | 16 | Medulla oblongata.l 5 mm, Medulla oblongata.r 5 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).l#t05 | 1572 a 1571 | 15 | Medulla oblongata.l 4 mm, Medulla oblongata.r 4 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).l#t06 | 1572 a 1572 | 6 | Medulla oblongata.l 4 mm, Medulla oblongata.r 7 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).r#t00 | 1471 a 1455 | 17 | Right common carotid artery 4 mm, Internal jugular vein.r 12 mm | sin candidato | extremo inferior a 4 mm de la superficie de Right common carotid artery |
| Vagus nerve (X).r#t01 | 1538 a 1525 | 38 | Laryngopharynx 19 mm, Internal jugular vein.r 32 mm | candidato: ramo faríngeo | extremo inferior a 19 mm de la superficie de Laryngopharynx |
| Vagus nerve (X).r#t02 | 1573 a 1128 | 601 | Stomach 5 mm, Diaphragm 31 mm | tronco del vago | el trazo más largo del lado |
| Vagus nerve (X).r#t03 | 1140 a 1130 | 19 | Stomach 6 mm, Diaphragm 40 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 69 mm debajo del final del esófago, a 6 mm de la superficie del estómago |
| Vagus nerve (X).r#t04 | 1133 a 1131 | 13 | Stomach 7 mm, Diaphragm 44 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 68 mm debajo del final del esófago, a 7 mm de la superficie del estómago |
| Vagus nerve (X).r#t05 | 1131 a 1130 | 5 | Stomach 6 mm, Diaphragm 45 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 68 mm debajo del final del esófago, a 6 mm de la superficie del estómago |
| Vagus nerve (X).r#t06 | 1141 a 1137 | 15 | Stomach 5 mm, Diaphragm 37 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 61 mm debajo del final del esófago, a 5 mm de la superficie del estómago |
| Vagus nerve (X).r#t07 | 1184 a 1164 | 29 | Stomach 3 mm, Diaphragm 14 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 35 mm debajo del final del esófago, a 3 mm de la superficie del estómago |
| Vagus nerve (X).r#t08 | 1171 a 1168 | 8 | Stomach 3 mm, Diaphragm 15 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 31 mm debajo del final del esófago, a 3 mm de la superficie del estómago |
| Vagus nerve (X).r#t09 | 1218 a 1211 | 46 | Stomach 3 mm, Diaphragm 19 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | extremo inferior a 3 mm de la superficie de Stomach |
| Vagus nerve (X).r#t10 | 1211 a 1190 | 32 | Stomach 2 mm, Diaphragm 38 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 8 mm debajo del final del esófago, a 2 mm de la superficie del estómago |
| Vagus nerve (X).r#t11 | 1207 a 1203 | 20 | Stomach 2 mm, Diaphragm 31 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | extremo inferior a 2 mm de la superficie de Stomach |
| Vagus nerve (X).r#t12 | 1216 a 1111 | 123 | Stomach 17 mm, Diaphragm 28 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | extremo inferior a 17 mm de la superficie de Stomach |
| Vagus nerve (X).r#t13 | 1151 a 1105 | 50 | Stomach 24 mm, Diaphragm 24 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | extremo inferior a 24 mm de la superficie de Stomach |
| Vagus nerve (X).r#t14 | 1154 a 1143 | 52 | Diaphragm 8 mm, Stomach 30 mm | sin candidato | extremo inferior a 8 mm de la superficie de Diaphragm |
| Vagus nerve (X).r#t15 | 1188 a 1150 | 46 | Stomach 3 mm, Diaphragm 19 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 49 mm debajo del final del esófago, a 3 mm de la superficie del estómago |
| Vagus nerve (X).r#t16 | 1155 a 1148 | 48 | Stomach 1 mm, Diaphragm 25 mm | candidato: ramo abdominal (gástrico, hepático o celíaco) | termina 51 mm debajo del final del esófago, a 1 mm de la superficie del estómago |
| Vagus nerve (X).r#t17 | 1576 a 1572 | 16 | Medulla oblongata.r 4 mm, Internal jugular vein.r 16 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).r#t18 | 1572 a 1569 | 16 | Medulla oblongata.r 5 mm, Medulla oblongata.l 5 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).r#t19 | 1572 a 1571 | 15 | Medulla oblongata.r 4 mm, Medulla oblongata.l 4 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |
| Vagus nerve (X).r#t20 | 1572 a 1572 | 6 | Medulla oblongata.r 4 mm, Medulla oblongata.l 7 mm | raicilla (sale del bulbo) | corto y a la altura del bulbo |

## Cómo se generó

- Modelo: Z-Anatomy, commit `9de5d6912a1b0df9cab739d57f00e036b0496ddc`. `Z-Anatomy.zip` y `TA2.csv` se sacaron de ese commit con git (la descarga directa de GitHub respondía 403) y `pipeline/descargar.py` verificó el SHA-256 de los dos contra `pipeline/comun.py`: coinciden.
- Blender como módulo: bpy 5.2.2 en Python 3.13.
- Fecha: 13 de octubre de 2026.

## Anclaje sustituido: ligamento arterioso

Z-Anatomy no trae el ligamento arterioso como objeto (tampoco en `docs/research/fase-0/inventario-z-anatomy.tsv`; el ADR 0009 lo daba por presente). Lo único con ese nombre es `Node of ligamentum arteriosum`, un ganglio linfático mediastínico de 86 vértices. En el modelo está:

- en x = 28,8 mm, y = 1367,6 mm, z = 4,2 mm (lado izquierdo);
- a 20,3 mm del eje del arco aórtico, que tiene radio 12,5 mm: 7,8 mm por debajo de su superficie;
- a 8,5 mm de la superficie de la bifurcación del tronco pulmonar.

Es el sitio del ligamento (entre la concavidad del arco y la bifurcación pulmonar), así que se usa como sustituto topográfico en `auditar-vago.py`, `rutas-vago.yaml` y la asimetría 2. Es otra estructura: lo confirma o lo rechaza un docente.

## Asimetrías

Eje anterior medido: +Z (centro de la tráquea en z = −1,8 mm, del esófago en z = −7,7 mm).

| # | Qué se comprueba | Escaneado (`npm test`) | Borrador (`generar-ramas-vago.py --borrador`) |
|---|---|---|---|
| 1 | Recurrente derecho bajo la subclavia derecha | no aplica (ruta trazada) | pasa: 5,6 mm por debajo y sube 51,2 mm |
| 2 | Recurrente izquierdo rodea el arco junto al ligamento | no aplica (ruta trazada) | pasa: 13,3 mm por debajo del arco, sube 87,6 mm, a 13,1 mm del ganglio del ligamento |
| 3 | Vago izquierdo delante del arco y detrás del bronquio izquierdo | no aplica (necesita la ruta distal) | falla: cruza el arco 0,5 mm "por detrás"; sí pasa detrás del bronquio izquierdo |
| 4 | Vago derecho detrás del bronquio derecho y del esófago | falla | falla (es la misma geometría escaneada) |

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

Ninguna de las dos se arregla en `rutas-vago.yaml`: el YAML solo gobierna lo trazado, y lo que falla es el tronco escaneado por encima de la bifurcación de la tráquea.

## Propuestas de `candidato()` que cambiaron

La versión anterior medía la distancia al centro de la caja de cada anclaje. Con órganos grandes eso engaña: el centro de la caja del diafragma quedaba más cerca que el del estómago, y t12 y t13 del lado derecho salían "sin candidato" aunque terminan unos 88 y 94 mm debajo del final del esófago y la superficie más cercana es la del estómago (17 y 24 mm). Ahora mide contra la superficie real (vértices con modificadores) y aplica una regla explícita: si el extremo inferior queda debajo del final de la línea central del esófago y a menos de 15 mm de la superficie del estómago, propone ramo abdominal. Siguen sin candidato t00 de cada lado (termina a 3 o 4 mm de la carótida común, a la altura del cricoides) y r#t14 (termina a 8 mm del diafragma y a 30 mm del estómago, cerca de la línea media).
