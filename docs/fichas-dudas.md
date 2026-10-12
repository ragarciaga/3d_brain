# Dudas abiertas en las fichas (para revisores docentes)

Actualizado: 2026-10-12. Todas las fichas están en `borrador`. Cada afirmación cita una fuente que
se abrió en PubMed o PMC (resumen o texto completo) y cada PMID o NBK se contrastó con su registro.
Eso no reemplaza la revisión docente (F24): esta lista dice dónde mirar primero.

## Cómo se verificaron las fuentes
- `verificada: true` quiere decir: el identificador, el título y los autores coinciden con el
  registro de PubMed, y el texto consultado (resumen o texto completo de PMC) dice lo que la ficha
  afirma con esa fuente.
- Los capítulos de StatPearls solo se pudieron leer por su extracto en PubMed (la página completa
  pide reCAPTCHA). Lo que el extracto no dice se respaldó con revisiones de acceso abierto.
- Los nombres de TA2 se compararon con `TA2.csv` de Z-Anatomy en el commit fijado (SHA-256 igual
  al de `pipeline/comun.py`).
- El enlace de Kenhub de la ficha del vago no se pudo abrir desde el entorno de trabajo.

## Sin ficha
- **Lóbulo grácil (`gracile-lobule`):** ninguna fuente abierta lo ubica ni da su equivalente de
  Larsell; Jung 2012 y Diano 2016 no coinciden sobre el lóbulo VIIB.

## Jerarquía del modelo
- **Valva posterior de la mitral** (`posterior-leaflet-of-left-atrioventricular-valve`): Z-Anatomy
  la cuelga de la tricúspide. Desde el 2026-10-12 va en el complejo valvular del corazón
  (`REUBICAR` en `pipeline/comun.py`), porque el modelo no trae grupo de la mitral.
- **Giro subcentral** (`insula-subcentral-gyrus-and-ant-and-post-sulci`): Z-Anatomy lo pone bajo
  la ínsula; Destrieux 2010 lo describe en la cara lateral (opérculo central), rodeando el extremo
  inferior del surco central. La ficha sigue a Destrieux.
- **Surco olfatorio:** Destrieux lo iguala al surco orbitario medial; Hastings 2024 los separa.
  Falta confirmar a cuál corresponde la malla.
- **Comisura del hipocampo:** la ficha describe la comisura dorsal (salterio); la ventral
  probablemente no existe en humanos.
- **Plexo coroideo:** la malla tiene lado, así que probablemente es el del ventrículo lateral.
- **Ficha del vago:** se quitó la frase sobre dónde termina el vago izquierdo en el modelo 3D; se
  verifica contra el GLB, no con fuentes.

## Equivalencias de nomenclatura por confirmar
- **Núcleos cocleares:** anterior = ventral y posterior = dorsal (Rushmore 2020, tabla TA98).
- **Cerebelo:** lóbulo cuadrangular posterior = lóbulo simple (H VI) y crus I y II = lóbulos
  semilunares superior e inferior (Voogd 2012). La amígdala cerebelosa como equivalente del
  paraflóculo dorsal del mono se apoya en parte en observaciones no publicadas.
- **Ramos bronquiales del vago:** las fuentes abiertas hablan de "ramos pulmonares"; se tomaron
  como los *rami bronchiales* de TA2.
- **Valvas cardíacas:** en la válvula inferior de la tricúspide y el papilar inferior del
  ventrículo derecho, "inferior" y "posterior" se usan como sinónimos; el papilar septal del
  ventrículo derecho tiene dos clasificaciones publicadas (Israel 2022 y Restivo 1989).
- **Pedúnculo cerebral:** el atlas lo usa como base más tegmento; muchos textos lo usan solo para la
  base (crus cerebri).
- **Cerebro (`g-cerebrum`):** el atlas reúne telencéfalo y diencéfalo, como TA2; muchos textos usan
  "cerebro" solo para el telencéfalo. La ficha lo aclara.
- **Istmo del cíngulo:** la parcela de Destrieux equivale solo de forma aproximada a la vPCC de
  Foster 2023, de donde salen sus datos funcionales.
- **Surco subparietal:** se trató como sinónimo del surco esplenial (Foster 2023, Willbrand 2023).

## Afirmaciones debatidas (se presentan las dos posturas)
Área de Broca, área de Wernicke, síndrome de Gerstmann, heminegligencia (región crítica), vía corta
tálamo y amígdala, teoría polivagal (fichas del vago y del núcleo ambiguo), ramo auricular del vago
y estimulación de la oreja, percepción del latido en ansiedad, corteza cingulada posterior dorsal,
área visual de la forma de las palabras, surco temporal superior, plano temporal y lateralización,
polo temporal, corteza parahipocampal, surco semilunar en la evolución.

## Datos de animales o de un solo estudio (van como `moderada` o atribuidos al estudio)
Núcleos septales, habénula, estrías medulares, accumbens, putamen, estriado dorsal, núcleos
anteriores del tálamo, área postrema, núcleo salival inferior, núcleo accesorio del oculomotor,
ramos hepáticos del vago, neuronas cardíacas del núcleo motor dorsal del vago, asimetría derecha e
izquierda de los ramos cardíacos, conteos de lóbulos pulmonares en series de tomografía,
valvas de la tricúspide (36 corazones de Athavale 2017).

## Puntos finos para revisar
- **Giros occipitales superiores:** ninguna fuente les asigna función propia; la ficha lo dice.
- **Núcleo ambiguo:** StatPearls lo ubica en el bulbo rostral; en libros de texto la columna ocupa
  buena parte del bulbo.
- **Núcleos salivales:** su ubicación en humanos es poco precisa en las fuentes.
- **Oliva:** la ficha la trata como el complejo olivar inferior; no hubo fuente abierta del relieve.
- **Ganglio superior del vago:** no hubo fuente abierta que diga si está dentro del agujero yugular
  o justo encima.
- **Ramos celíacos del vago:** las fuentes no coinciden en hasta dónde llegan en el colon.
- **Giro occipital inferior:** "por debajo del giro lingual" es literal de Winawer y Witthoft; vale
  la pena revisarlo.
- **Troncos vagales:** se describen como continuación de cada vago, la simplificación habitual;
  cada tronco lleva fibras de ambos.
