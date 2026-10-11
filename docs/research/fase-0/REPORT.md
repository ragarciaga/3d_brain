# Fase 0: inventario de Z-Anatomy

Fecha: 2026-10-11. Compuerta de la fase 0 del SPEC (sección 4).

## Fuente analizada

- Repositorio `Z-Anatomy/Models-of-human-anatomy`, commit `9de5d6912a1b0df9cab739d57f00e036b0496ddc`.
- `Z-Anatomy.zip` (86,7 MB) contiene `Z-Anatomy/Startup.blend` (306,8 MB, fechado en mayo de 2023).
- Licencia: CC BY-SA 4.0. Incluye `TA2.csv` (Terminologia Anatomica 2: inglés, latín, francés, español, portugués, italiano, persa).
- Herramienta: `bpy` 5.2.2 (Blender como módulo de Python 3.13), sin interfaz, con scripts del archivo deshabilitados (`use_scripts=False`).

La versión enlazada en Google Drive desde `LluisV/Z-Anatomy` no se analizó; si se usa, se repite este inventario sobre ella.

## Cómo reproducirlo

```bash
pip install bpy==5.2.2
python -I docs/research/fase-0/scripts/inv.py -- inventario.tsv ruta/a/Startup.blend
```

`inv.py` lista todos los objetos con tipo, colecciones, padre, vértices y modificadores. `vag.py` describe las curvas del vago, `chk.py` revisa mallas cerradas, jerarquía y alturas, y `geo.py` mide el sistema nervioso completo. `inventario-z-anatomy.tsv` es la salida de `inv.py` sin los objetos de texto (rótulos).

## Hallazgos

### Tamaño y tipos

- 7.184 objetos: 4.569 mallas, 951 curvas, 1.660 textos (rótulos), 3 luces, 1 cámara.
- Sistema nervioso (colección `7: Nervous system & Sense organs`, sin rótulos): 588 objetos, de ellos **249 curvas** (los nervios) y **100 con modificadores**. Todos tienen padre. Con modificadores aplicados suman unos 2,4 millones de triángulos.
- Escala métrica (1 unidad = 1 m), Z arriba.
- Nombres en inglés con sufijo `.l` / `.r` por lado. Sufijos de apoyo: `.g` (grupo, objeto de texto), `.t` (rótulo), `.j` (ancla del rótulo, 2 vértices). Estos no son geometría de estudio.

### Nervio vago

- `Vagus nerve (X).l` y `Vagus nerve (X).r`: tipo **CURVE**, `bevel_depth` 0,0005 m (tubo de 1 mm de diámetro), padre `Cranial nerves.g`.
- El derecho tiene 21 trazos (splines) y el izquierdo 7, todos dentro del mismo objeto y sin nombre.
- Altura en el mundo: derecho de z 1,105 a 1,576; izquierdo de z 1,346 a 1,576. Referencias: estómago 1,104 a 1,229; esófago 1,194 a 1,476; tráquea 1,355 a 1,461; ventrículo izquierdo 1,237 a 1,326. **El derecho llega al estómago; el izquierdo termina donde acaba la tráquea.**
- Una curva del vago derecho convertida a malla: 23.508 vértices, unos 46.000 triángulos.
- No hay objetos con nombre de ramo (auricular, faríngeo, laríngeo superior o recurrente, cardíacos, troncos vagales, gástricos) ni de plexo (cardíaco, pulmonar, esofágico, celíaco). No hay ganglios superior ni inferior.
- Sí hay núcleos en el bulbo, como mallas por lado: `Nucleus of solitary tract`, `Nucleus ambiguus`, `Posterior nucleus of vagus nerve`. El del tracto solitario son 5 vértices con modificadores `SKIN` y `SUBSURF`: sin aplicarlos no tiene forma.

### Cerebro

Existen como mallas (por lado salvo donde se indica): hipocampo, cuerpo amigdalino, tálamo, hipotálamo (una pieza), ínsula, giros del cíngulo (por partes), núcleo caudado, putamen, globo pálido, núcleo lentiforme, fórnix, cuerpo calloso, comisura del hipocampo, habénula, glándula pineal, cuerpos geniculados lateral y medial, núcleos septales, septo pelúcido, hipófisis, mesencéfalo, puente, bulbo, oliva, cerebelo, ventrículos laterales, tercero y cuarto, acueducto, plexos coroideos y 111 mallas de giros y surcos (parcelación tipo Destrieux, por ejemplo `Opercular part of inferior frontal gyrus`, `Straight gyrus (Gyrus rectus)`).

Cuerpos mamilares: sí existen, por lado, escritos `Mamillary body` (con una sola m); una primera búsqueda por "mammillary" no los encontró.

No existen: sustancia gris periacueductal, locus coeruleus, núcleos del rafe, núcleo accumbens, área postrema, núcleo anterior del tálamo, agujero yugular como objeto.

### Jerarquía

Cada pieza cuelga de grupos `.g` que forman el árbol anatómico, por ejemplo:
`Hippocampus.l > Limbic lobe.g > Telencephalon.g > Cerebrum.g > Brain.g > Central nervous system.g`.
Sirve para F2 y para separar por nivel en F6.

### Mallas cerradas (relevante para F8)

| Pieza | Triángulos | Bordes abiertos |
|---|---|---|
| Hipocampo | 1.020 | 0 |
| Amígdala | 384 | 0 |
| Tálamo | 758 | 0 |
| Caudado | 2.570 | 0 |
| Putamen | 1.150 | 0 |
| Ventrículo lateral | 2.898 | 0 |
| Hipotálamo | 4.258 | 0 (4 aristas no manifold) |
| Giro precentral | 1.532 | 2 |
| Giro frontal superior | 3.735 | 11 |
| Puente | 10.171 | 1 |

### Nombres

De 322 estructuras únicas del sistema nervioso (sin sufijo de lado), 293 casan exacto con la columna inglesa de `TA2.csv`, que da latín y español. Ejemplos: `Amygdaloid body` = `Corpus amygdaloideum` = `Cuerpo amigdaloide`; `Nucleus of solitary tract` = `Nucleus tractus solitarii` = `Núcleo del tracto solitario`. Las 29 restantes (por ejemplo las parcelas con asterisco de la ínsula) van `PENDIENTE`.

## Consecuencias para el pipeline

1. Listar todos los objetos con su tipo, no solo mallas.
2. Convertir curvas a malla y aplicar modificadores al exportar.
3. Conservar `matrix_world` al borrar los grupos padre.
4. Verificar posiciones con cajas envolventes antes y después.

## Fuentes externas evaluadas para completar faltantes

| Fuente | Qué aporta | Licencia | Veredicto |
|---|---|---|---|
| SPL/NAC Brain Atlas (Open Anatomy, Harvard), espejo `stity/spl-brain-atlas` | Etiquetas de núcleo accumbens y tracto mamilotalámico, por lado (los mamilares ya vienen en Z-Anatomy) | Licencia de 3D Slicer (permisiva, pide reconocimiento) | Candidata. Requiere alineación con el cerebro de Z-Anatomy y confirmar compatibilidad en un ADR |
| Brainstem Navigator (MGH, NITRC) | Núcleos del tronco encefálico | Solo investigación no comercial; prohíbe redistribuir | Descartada |
| CIT168 (Caltech) | Núcleos subcorticales | Licencia de los datos sin confirmar | No usar hasta confirmarla |
| Modelos de la Universidad de Dundee | Pares craneales | CC BY-NC-SA en los que se pudo verificar | Incompatible con CC BY-SA |
| BodyParts3D (DBCLS) | Troncos del vago según un protocolo de SPARC | CC BY-SA 2.1 JP | Por investigar: servidor no accesible desde la sesión |
| SPARC (NIH), modelo del vago humano | Vago con información de ramos | Sin confirmar | Por investigar |
