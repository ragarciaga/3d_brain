# Resumen de las propuestas de marcadores

Lo escribe `node scripts/aplicar-marcadores.ts` a partir de las propuestas de `pipeline/ubicar-marcadores.py`. Toda posición propuesta queda `aproximada` hasta que un docente la revise (ADR 0013).

## m-superior-ganglion-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02349,1.57094,-0.01283],"r":[-0.02349,1.57094,-0.01283]}; ancla ninguna
- Regla: Sobre la curva del vago, 2,5 mm por encima del punto del foramen yugular (derivado: punto medio del rango de 0 a 5 mm sobre el extremo de la vena, a partir del tamaño del ganglio, de unos 4 mm, pequeño y esférico dentro del foramen).
- Fuente: Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.; Kim CY, Park JS, Chung BS. Identification of cranial nerve ganglia using sectioned images and three-dimensional models of a cadaver. Korean J Pain. 2022. PMID 35768980. PMCID PMC9251397. DOI 10.3344/kjp.2022.35.3.250.; Libreros-Jiménez HM, Manzo J, Rojas-Durán F, et al. On the Cranial Nerves. NeuroSci. 2024. PMID 39483811. PMCID PMC11523702. DOI 10.3390/neurosci5010002.

## m-inferior-ganglion-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02735,1.55984,-0.00529],"r":[-0.02735,1.55984,-0.00529]}; ancla ninguna
- Regla: Sobre la curva del vago, 12,5 mm por debajo del punto del foramen yugular (derivado: punto medio del rango de 1 a 1,5 cm, a partir de la longitud del ganglio, de unos 2,5 cm que arrancan en la salida del foramen). Queda por encima del origen del laríngeo superior.
- Fuente: Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.; Kim CY, Park JS, Chung BS. Identification of cranial nerve ganglia using sectioned images and three-dimensional models of a cadaver. Korean J Pain. 2022. PMID 35768980. PMCID PMC9251397. DOI 10.3344/kjp.2022.35.3.250.

## m-auricular-branch-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02349,1.57094,-0.01283],"r":[-0.02349,1.57094,-0.01283]}; ancla ninguna
- Regla: El ramo nace del ganglio superior y va hacia el conducto auditivo externo, pero no hay malla de oído ni de hueso temporal: el punto es su origen, el ganglio superior, 2,5 mm por encima del foramen yugular (derivado, igual que en el ganglio superior). Queda en el mismo sitio que ese marcador.
- Fuente: Constanzo F, Coelho Neto M, Nogueira GF, Ramina R. Microsurgical Anatomy of the Jugular Foramen Applied to Surgery of Glomus Jugulare via Craniocervical Approach. Front Surg. 2020. PMID 32500078. PMCID PMC7243180. DOI 10.3389/fsurg.2020.00027.; Libreros-Jiménez HM, Manzo J, Rojas-Durán F, et al. On the Cranial Nerves. NeuroSci. 2024. PMID 39483811. PMCID PMC11523702. DOI 10.3390/neurosci5010002.

## m-pharyngeal-branch-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02532,1.54758,-0.00024],"r":[-0.02532,1.54758,-0.00024]}; ancla ninguna
- Regla: Sobre la curva del vago, 26 mm por debajo del punto del foramen yugular (mediana de 2,6 cm, rango intercuartílico de 2,0 a 3,5 cm). Si la pared de la laringofaringe queda a 5 mm o menos de ese punto, el marcador se acerca a ella (derivado: el modelo no trae el constrictor medio de la faringe, que queda por encima de la laringofaringe, y el umbral de 5 mm es el del diseño).
- Fuente: Mansour Y, Kulesza R. A rare variation of the glossopharyngeal nerve. Anat Cell Biol. 2021. PMID 33850061. PMCID PMC8225476. DOI 10.5115/acb.21.005.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.; Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.

## m-superior-laryngeal-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02543,1.53568,0.00081],"r":[-0.02543,1.53568,0.00081]}; ancla ninguna
- Regla: Sobre la curva del vago, 38 mm por debajo del punto del foramen yugular (mediana de 3,8 cm, rango intercuartílico de 3,3 a 4,8 cm). Si el cartílago tiroides queda a 5 mm o menos de ese punto, el marcador se acerca a él, porque el nervio va hacia el borde superior posterior del cartílago, por donde su rama interna atraviesa la membrana tirohioidea (derivado: el umbral de 5 mm es el del diseño).
- Fuente: Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.; Vrapciu AD, Brezean I, Tudose RC, Rusu MC, Triantafyllou G, Piagkou M. The Sensory Gatekeeper of the Larynx: Anatomy and Clinical Importance of the Internal Branch of the Superior Laryngeal Nerve. Diagnostics (Basel). 2025. PMID 40647708. PMCID PMC12248794. DOI 10.3390/diagnostics15131711.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.

## m-superior-cervical-cardiac-branches-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.0165,1.4242,-0.00211],"r":[-0.01665,1.4445,0.00157]}; ancla ninguna
- Regla: Sobre la curva del vago, a la altura media entre la prominencia laríngea (punto más anterior del cartílago tiroides) y el asa del laríngeo recurrente de ese lado (derivado: punto medio del tramo entre la prominencia laríngea y el origen del recurrente, por encima de la arteria subclavia; las fuentes dicen que los ramos cardíacos del cuello quedan casi todos entre la prominencia laríngea y la clavícula, y que el superior sale por encima del origen del recurrente, pero el punto medio y esa combinación de límites son deducción propia).
- Fuente: Zandstra TE, Notenboom RGE, Wink J, et al. Asymmetry and Heterogeneity: Part and Parcel in Cardiac Autonomic Innervation and Function. Front Physiol. 2021. PMID 34603069. PMCID PMC8481575. DOI 10.3389/fphys.2021.665298.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.

## m-inferior-cervical-cardiac-branches-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02279,1.37264,0.00608],"r":[-0.02146,1.41325,0.00257]}; ancla ninguna
- Regla: Por definición son los ramos cardíacos que salen del laríngeo recurrente, en cualquier punto de su recorrido. Va junto al asa del recurrente, bajo la arteria subclavia derecha o bajo el arco aórtico (derivado: la fuente no da altura; mismo punto que el asa del recurrente, por eso coincide con el marcador del recurrente).
- Fuente: Zandstra TE, Notenboom RGE, Wink J, et al. Asymmetry and Heterogeneity: Part and Parcel in Cardiac Autonomic Innervation and Function. Front Physiol. 2021. PMID 34603069. PMCID PMC8481575. DOI 10.3389/fphys.2021.665298.

## m-recurrent-laryngeal-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02279,1.37264,0.00608],"r":[-0.02146,1.41325,0.00257]}; ancla ninguna
- Regla: Punto más bajo del asa del nervio. El derecho rodea por debajo la arteria subclavia derecha. El izquierdo nace en la cara inferior del arco aórtico, junto al ligamento arterioso, y lo rodea. Z-Anatomy no trae el ligamento, así que `Node of ligamentum arteriosum` es el sustituto del ligamento arterioso. (derivado: el punto más bajo del asa se calcula como el punto de la arteria subclavia derecha más cercano al vago derecho, o del arco aórtico más cercano al sustituto del ligamento, y desde ahí el vértice más bajo sobre un rayo hacia abajo; la fuente solo describe el recorrido del asa). La fuente dice que el izquierdo nace inmediatamente lateral al ligamento arterioso; esta regla no aplica ese "lateral": toma el punto del arco más cercano al sustituto, sin desplazarlo hacia el lado.
- Fuente: Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.; White A, Deeb AL. Anatomy of mediastinal veins and nerves. Mediastinum. 2023. PMID 37261092. PMCID PMC10226887. DOI 10.21037/med-20-65.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.

## m-thoracic-cardiac-branches-of-vagus-nerve

- Resultado: actualizado a mano (Plan B): perdió su posición
- Antes: aproximada; posición {"l":[0.01746,1.37425,0.00055],"r":[-0.01791,1.3941,-0.00282]}; ancla ninguna
- Después: sin_ubicar; posición sin posición; ancla ninguna
- Regla: Sobre el tronco del vago escaneado del modelo, a la altura media entre el asa del recurrente y el borde superior del bronquio principal de ese lado (derivado: punto medio del tramo entre el origen del recurrente, bajo el cual sale el ramo según la fuente, y el bronquio; el límite en el bronquio y el punto medio son elección de la regla). Ojo: ese tramo del modelo es un espejo (ADR 0010), por lo que se vuelve a ubicar cuando se publique el vago torácico trazado.
- Fuente: Zandstra TE, Notenboom RGE, Wink J, et al. Asymmetry and Heterogeneity: Part and Parcel in Cardiac Autonomic Innervation and Function. Front Physiol. 2021. PMID 34603069. PMCID PMC8481575. DOI 10.3389/fphys.2021.665298.; Liu X, Chen Z, Zhang S. Application of Vagus Nerve Branch Preservation in Thoracoscopic Surgery for Early-Stage Lung Cancer. Biomed Res Int. 2022. PMID 35445140. PMCID PMC9015860. DOI 10.1155/2022/5143383.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.
- Motivo: sin posición: la regla de `pipeline/reglas-marcadores.yaml` lo puso sobre el tronco escaneado del vago, y ese tramo del modelo es un espejo izquierda-derecha (ADR 0010) que el atlas no publica en el lanzamiento docente (Plan B, 18 de octubre de 2026): el punto quedaba a 0,5 mm (izquierdo) y 0,7 mm (derecho) del tronco retirado y, en el izquierdo, donde el espejo pasa por dentro del arco aórtico. Se retiró a mano, sin volver a correr `pipeline/ubicar-marcadores.py`; si se vuelve a correr, la regla lo devuelve al tronco espejo. Se ubica de nuevo cuando se trace el vago torácico.

## m-bronchial-branches-of-vagus-nerve

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.04164,1.32553,-0.02754],"r":[-0.01665,1.35374,-0.022]}; ancla ninguna
- Regla: Ninguna fuente leída usa el término ramos bronquiales; se ubica como el plexo pulmonar, que es lo que describen: cara posterior del bronquio principal de cada lado, en la entrada al hilio, que se toma como el 25 % lateral del bronquio (derivado). Queda en el mismo punto que el plexo pulmonar y pide una fuente que nombre estos ramos.
- Fuente: Huang W, Yang J, Chen H, Li P, Wei W. Preservation of the pulmonary branches of the vagus nerve during three-dimensional thoracoscopic radical resection of lung cancer: a retrospective study. BMC Surg. 2024. PMID 38336679. PMCID PMC10858570. DOI 10.1186/s12893-024-02347-w.; White A, Deeb AL. Anatomy of mediastinal veins and nerves. Mediastinum. 2023. PMID 37261092. PMCID PMC10226887. DOI 10.21037/med-20-65.

## m-pulmonary-plexus

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.04164,1.32553,-0.02754],"r":[-0.01665,1.35374,-0.022]}; ancla ninguna
- Regla: Cara posterior del bronquio principal de cada lado, en la entrada al hilio, que se toma como el 25 % lateral del bronquio (derivado). Los dos vagos pasan por detrás de los bronquios y forman o alimentan el plexo en el hilio.
- Fuente: White A, Deeb AL. Anatomy of mediastinal veins and nerves. Mediastinum. 2023. PMID 37261092. PMCID PMC10226887. DOI 10.21037/med-20-65.; Huang W, Yang J, Chen H, Li P, Wei W. Preservation of the pulmonary branches of the vagus nerve during three-dimensional thoracoscopic radical resection of lung cancer: a retrospective study. BMC Surg. 2024. PMID 38336679. PMCID PMC10858570. DOI 10.1186/s12893-024-02347-w.; Liu X, Chen Z, Zhang S. Application of Vagus Nerve Branch Preservation in Thoracoscopic Surgery for Early-Stage Lung Cancer. Biomed Res Int. 2022. PMID 35445140. PMCID PMC9015860. DOI 10.1155/2022/5143383.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.

## m-oesophageal-plexus

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.00357,1.26592,-0.01194]; ancla ninguna
- Regla: Sobre la superficie del esófago, a la altura media entre el extremo inferior de los bronquios principales y el hiato esofágico (derivado: punto medio del tramo bajo los bronquios; la cara anterior se elige solo para dejar el punto a la vista; el hiato es el punto de la línea central del esófago más cercano al diafragma).
- Fuente: Triantafyllou G, Mylonakis A, Dimitriou N, et al. Anatomical Variations in Critical Structures in Esophageal Surgery: Implications for Personalized Surgery. J Pers Med. 2026. PMID 42346602. PMCID PMC13302663. DOI 10.3390/jpm16060291.; White A, Deeb AL. Anatomy of mediastinal veins and nerves. Mediastinum. 2023. PMID 37261092. PMCID PMC10226887. DOI 10.21037/med-20-65.; Bahadir S, Chen FL, Tamas IP, McGonagle ER, Nassrallah Z, Pelcher I, Sun J, Xing T, Titunick M, Knutson S, Levy T, Chang EH, Hill RV, Zanos TP, Barbe MF, Zanos S. A standardized, surgically relevant map for emergence of organ-specific branches from the human vagus nerve. Brain Stimul. 2026. PMID 42595102. PMCID PMC13634496. DOI 10.1016/j.brs.2026.103182.; In SY, Cho TH, Yang HM. The vagus nerve as a neurovisceral interface: a comprehensive review. Front Neurosci. 2026. PMID 42535110. PMCID PMC13422532. DOI 10.3389/fnins.2026.1878765.
- Desacuerdo: Triantafyllou 2026 empieza el plexo a la altura de la tráquea distal y el esófago proximal, mientras que White 2023 y Bahadir 2026 lo ponen bajo los bronquios y como el grupo de ramos más distal. La regla usa el tramo bajo los bronquios, que es donde coinciden.

## m-anterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.00343,1.21638,0.00951]; ancla ninguna
- Regla: Cara anterior del esófago a la altura del diafragma, donde cruza el hiato (derivado: el hiato es el punto de la línea central del esófago más cercano a la malla del diafragma). Viene del vago izquierdo, que baja por la cara ventral del esófago.
- Fuente: McMahon JT, Raheb Khelo R, Weinberg BD, Boulis NM. Neurogenic irritable bowel syndrome? Long-term resolution of chronic gastrointestinal stress following vagus nerve microvascular decompression: illustrative case. J Neurosurg Case Lessons. 2026. PMID 41974052. PMCID PMC13072447. DOI 10.3171/case2688.; Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; In SY, Cho TH, Yang HM. The vagus nerve as a neurovisceral interface: a comprehensive review. Front Neurosci. 2026. PMID 42535110. PMCID PMC13422532. DOI 10.3389/fnins.2026.1878765.

## m-posterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.00183,1.22019,0.00031]; ancla ninguna
- Regla: Cara posterior del esófago a la altura del diafragma, donde cruza el hiato (derivado: el hiato es el punto de la línea central del esófago más cercano a la malla del diafragma). Viene del vago derecho, que pasa a la cara dorsal del esófago.
- Fuente: McMahon JT, Raheb Khelo R, Weinberg BD, Boulis NM. Neurogenic irritable bowel syndrome? Long-term resolution of chronic gastrointestinal stress following vagus nerve microvascular decompression: illustrative case. J Neurosurg Case Lessons. 2026. PMID 41974052. PMCID PMC13072447. DOI 10.3171/case2688.; Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; In SY, Cho TH, Yang HM. The vagus nerve as a neurovisceral interface: a comprehensive review. Front Neurosci. 2026. PMID 42535110. PMCID PMC13422532. DOI 10.3389/fnins.2026.1878765.

## m-anterior-gastric-branches-of-anterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.0139,1.19684,0.03229]; ancla ninguna
- Regla: Cara anterior del estómago junto al cardias, donde el tronco se divide; los ramos siguen la curvatura menor (derivado: la cara anterior sale de que el tronco es ventral; el cardias se toma como el extremo inferior de la línea central del esófago).
- Fuente: Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; Smyth SL, Aggarwal A, Soleymani Majd H. Nerve sparing excision of gastrohepatic ligament lesion as part of cytoreductive surgical management of advanced ovarian malignancy. Transl Cancer Res. 2025. PMID 39974417. PMCID PMC11833392. DOI 10.21037/tcr-24-950.

## m-posterior-gastric-branches-of-posterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.01377,1.1993,0.01088]; ancla ninguna
- Regla: Cara posterior del estómago junto al cardias, donde el tronco se divide; los ramos siguen la curvatura menor (derivado: la cara posterior sale de que el tronco es dorsal; el cardias se toma como el extremo inferior de la línea central del esófago).
- Fuente: Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; Smyth SL, Aggarwal A, Soleymani Majd H. Nerve sparing excision of gastrohepatic ligament lesion as part of cytoreductive surgical management of advanced ovarian malignancy. Transl Cancer Res. 2025. PMID 39974417. PMCID PMC11833392. DOI 10.21037/tcr-24-950.

## m-hepatic-branches-of-anterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.00921,1.20025,0.01686]; ancla ninguna
- Regla: Punto medio entre el cardias y el punto del hígado más cercano a él (derivado: representa el trayecto por el omento menor hasta el hilio hepático; la fuente da el recorrido en palabras y no una posición, y el cardias se toma como el extremo inferior de la línea central del esófago).
- Fuente: Zhang AY, Guo ZH, Huang Y, et al. Vagal nerve innervation divergence in liver/pancreas: A forgotten key to endocrine recovery after transplantation? World J Transplant. 2026. PMID 42281852. PMCID PMC13250772. DOI 10.5500/wjt.v16.i2.118169.; Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; Chen S, Zheng Y, Cai J, Wu Y, Chen X. Gallstones after bariatric surgery: mechanisms and prophylaxis. Front Surg. 2025. PMID 40182307. PMCID PMC11966458. DOI 10.3389/fsurg.2025.1506780.; Kong SH, Kim SM, Kim DG, et al. Intraoperative Neurophysiologic Testing of the Perigastric Vagus Nerve Branches to Evaluate Viability and Signals along Nerve Pathways during Gastrectomy. J Gastric Cancer. 2019. PMID 30944758. PMCID PMC6441774. DOI 10.5230/jgc.2019.19.e2.

## m-coeliac-branches-of-posterior-vagal-trunk

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición [0.00837,1.21057,-0.00106]; ancla ninguna
- Regla: Regla aproximada: cara anterior de la aorta torácica en su extremo inferior, justo por debajo del hiato, a la altura del tronco celíaco (derivado: el modelo no trae la arteria gástrica izquierda ni el tronco celíaco, y la aorta torácica termina en el hiato).
- Fuente: Guo H, Sun W, Duan H, Zhang C, Wei M, Liang P, Hu X, Cao L. Preservation of the celiac branch of the vagus nerve reduces the incidence of postoperative diarrhea in gastric cancer: a cohort study. World J Surg Oncol. 2024. PMID 38582834. PMCID PMC10998355. DOI 10.1186/s12957-024-03370-0.; Kong SH, Kim SM, Kim DG, et al. Intraoperative Neurophysiologic Testing of the Perigastric Vagus Nerve Branches to Evaluate Viability and Signals along Nerve Pathways during Gastrectomy. J Gastric Cancer. 2019. PMID 30944758. PMCID PMC6441774. DOI 10.5230/jgc.2019.19.e2.; McMahon JT, Raheb Khelo R, Weinberg BD, Boulis NM. Neurogenic irritable bowel syndrome? Long-term resolution of chronic gastrointestinal stress following vagus nerve microvascular decompression: illustrative case. J Neurosurg Case Lessons. 2026. PMID 41974052. PMCID PMC13072447. DOI 10.3171/case2688.
- Desacuerdo: Guo 2024 da al ramo celíaco como rama del tronco posterior, mientras que McMahon 2026 dice que el tronco posterior solo aporta algo más al plexo celíaco.

## m-jugular-foramen

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02511,1.56984,-0.01134],"r":[-0.02511,1.56984,-0.01134]}; ancla ninguna
- Regla: Punto de la curva del vago de cada lado más cercano al extremo superior de la vena yugular interna del mismo lado. La vena empieza en el foramen yugular, por donde el vago sale del cráneo junto a los nervios IX y XI.
- Fuente: Lee JH, Cheng KL, Choi YJ, Baek JH. High-resolution Imaging of Neural Anatomy and Pathology of the Neck. Korean J Radiol. 2017. PMID 28096728. PMCID PMC5240499. DOI 10.3348/kjr.2017.18.1.180.; Freitas CAF, Santos LRMD, Santos AN, Amaral Neto ABD, Brandão LG. Anatomical study of jugular foramen in the neck. Braz J Otorhinolaryngol. 2020. PMID 30348503. PMCID PMC9422587. DOI 10.1016/j.bjorl.2018.09.004.; OpenStax. Anatomy and Physiology 2e, 20.5 Circulatory Pathways. 2022. https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways.; Constanzo F, Coelho Neto M, Nogueira GF, Ramina R. Microsurgical Anatomy of the Jugular Foramen Applied to Surgery of Glomus Jugulare via Craniocervical Approach. Front Surg. 2020. PMID 32500078. PMCID PMC7243180. DOI 10.3389/fsurg.2020.00027.

## m-caerulean-nucleus

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `pons`
- Después: aproximada; posición {"l":[0.00634,1.58926,-0.02217],"r":[-0.00633,1.58926,-0.02217]}; ancla `pons`
- Regla: En la mitad rostral del cuarto ventrículo, junto a su pared lateral de cada lado, y 1,5 mm ventral (derivado: la fuente solo dice que el núcleo queda justo debajo del piso del cuarto ventrículo y cerca de su pared lateral; los milímetros, punto medio de un rango de 1 a 2 mm, son deducción propia y no una medida de la fuente; la mitad rostral es la mitad superior de la malla). Un punto por lado.
- Fuente: Galgani A, Giorgi FS. Exploring the Role of Locus Coeruleus in Alzheimer's Disease: a Comprehensive Update on MRI Studies and Implications. Curr Neurol Neurosci Rep. 2023. PMID 38064152. PMCID PMC10724305. DOI 10.1007/s11910-023-01324-9.; Reyes BAS. The Locus Coeruleus: Anatomy, Physiology, and Stress-Related Neuropsychiatric Disorders. Eur J Neurosci. 2025. PMID 40219735. PMCID PMC11992612. DOI 10.1111/ejn.70111.; Galgani A, Scotto M, Faraguna U, Giorgi FS. Fading Blue: Exploring the Causes of Locus Coeruleus Damage Across the Lifespan. Antioxidants (Basel). 2025. PMID 40227216. PMCID PMC11939699.

## m-raphe-nuclei-of-medulla-oblongata

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `medulla-oblongata`
- Después: aproximada; posición [0,1.57017,-0.01645]; ancla `medulla-oblongata`
- Regla: Plano medio entre las dos mitades del bulbo, a la altura del centro de las olivas inferiores, y a medio camino entre la cara ventral y la dorsal (derivado: la profundidad media, porque los núcleos del rafe son un continuo sin bordes claros).
- Fuente: Agostinelli LJ, Seaman SC, Saper CB, Fykstra DP, Hefti MM, Koscik TR, Dlouhy BJ, Bassuk AG. Human Brainstem and Cerebellum Atlas: Chemoarchitecture and Cytoarchitecture Paired to MRI. J Neurosci. 2023. PMID 36442999. PMCID PMC9838717. DOI 10.1523/jneurosci.0587-22.2022.

## m-area-postrema

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `medulla-oblongata`
- Después: aproximada; posición [0,1.56463,-0.03089]; ancla `medulla-oblongata`
- Regla: En la línea media, a la altura del punto más caudal del cuarto ventrículo (el óbex), sobre la cara dorsal del bulbo, donde el área postrema toca el ángulo caudal del piso del ventrículo.
- Fuente: Lara-García J, Romo-Martínez J, De-La-Cruz-Cisneros JJ, Olvera-Olvera MA, Márquez-Bejarano LJ. Unmasking the Area Postrema on MRI: Utility of 3D FLAIR, 3D-T2, and 3D-DIR Sequences in a Case-Control Study. J Imaging. 2025. PMID 39852329. PMCID PMC11765964. DOI 10.3390/jimaging11010016.; Agostinelli LJ, Seaman SC, Saper CB, Fykstra DP, Hefti MM, Koscik TR, Dlouhy BJ, Bassuk AG. Human Brainstem and Cerebellum Atlas: Chemoarchitecture and Cytoarchitecture Paired to MRI. J Neurosci. 2023. PMID 36442999. PMCID PMC9838717. DOI 10.1523/jneurosci.0587-22.2022.

## m-nucleus-accumbens

- Resultado: actualizado
- Antes: sin_ubicar; posición sin posición; ancla ninguna
- Después: aproximada; posición {"l":[0.02019,1.62248,0.02577],"r":[-0.02019,1.62248,0.02577]}; ancla `caudate-nucleus`
- Regla: Bajo el sitio donde el caudado y el putamen se acercan, por delante del extremo posterior de la comisura anterior (derivado: el límite caudal se toma en ese extremo, que es el que da la fuente; la cara inferior se elige porque el núcleo queda ventral). Un punto por lado.
- Fuente: Birbilis T, Siozopoulos A, Fiska A, Deftereos S, Kaldoudi E, Karagiannis V, Thomaidis V. Volumetric data of normal nucleus accumbens from magnetic resonance imaging scans. Med Pharm Rep. 2021. PMID 36105490. PMCID PMC9389875. DOI 10.15386/mpr-2004.

## m-periaqueductal-grey

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `aqueduct-of-midbrain`
- Después: aproximada; posición [0,1.60981,-0.01229]; ancla `aqueduct-of-midbrain`
- Regla: Centro del acueducto del mesencéfalo, que la sustancia gris periacueductal rodea (derivado: la fuente solo dice que la sustancia gris rodea el acueducto; un desplazamiento de unos milímetros hacia dorsal sería deducción propia y no se aplica).
- Fuente: Truong P, Kim JH, Savjani R, Sitek KR, Hagberg GE, Scheffler K, Ress D. Depth relationships and measures of tissue thickness in dorsal midbrain. Hum Brain Mapp. 2020. PMID 32870572. PMCID PMC7670631. DOI 10.1002/hbm.25185.; Agostinelli LJ, Seaman SC, Saper CB, Fykstra DP, Hefti MM, Koscik TR, Dlouhy BJ, Bassuk AG. Human Brainstem and Cerebellum Atlas: Chemoarchitecture and Cytoarchitecture Paired to MRI. J Neurosci. 2023. PMID 36442999. PMCID PMC9838717. DOI 10.1523/jneurosci.0587-22.2022.

## m-anterior-nuclei-of-thalamus

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `thalamus`
- Después: aproximada; posición {"l":[0.00858,1.63077,0.00769],"r":[-0.00858,1.63077,0.00769]}; ancla `thalamus`
- Regla: Polo anterosuperior de cada tálamo (derivado: la fuente ubica el grupo anterior en el tercio rostral, dentro del tubérculo anterior, y el polo es la aproximación a ese rincón). Un punto por lado.
- Fuente: Grodd W, Kumar VJ, Schüz A, Lindig T, Scheffler K. The anterior and medial thalamic nuclei and the human limbic system: tracing the structural connectivity using diffusion-weighted imaging. Sci Rep. 2020. PMID 32616764. PMCID PMC7331724. DOI 10.1038/s41598-020-67770-4.; Sitnikov AR, Grigoryan YA, Mishnyakova LP. Bilateral stereotactic lesions and chronic stimulation of the anterior thalamic nuclei for treatment of pharmacoresistant epilepsy. Surg Neurol Int. 2018. PMID 30105131. PMCID PMC6069370. DOI 10.4103/sni.sni_25_18.; Yu K, Ren Z, Yu T, Wang X, Hu Y, Guo S, Li J, Li Y. Direct Targeting of the Anterior Nucleus of the Thalamus via 3 T Quantitative Susceptibility Mapping. Front Neurosci. 2021. PMID 34290583. PMCID PMC8287058. DOI 10.3389/fnins.2021.685050.

## m-wernicke-area

- Resultado: actualizado
- Antes: aproximada; posición sin posición; ancla `superior-temporal-gyrus-lateral-part-l`
- Después: aproximada; posición [0.0581,1.63982,-0.04238]; ancla `superior-temporal-gyrus-lateral-part-l`
- Regla: Solo hemisferio izquierdo, en la definición clásica: tercio posterior de la parte lateral de la circunvolución temporal superior, junto al plano temporal (derivado: "tercio posterior" como 0,33333 del largo del plano temporal hacia atrás; es la regla mínima común a las fuentes).
- Fuente: Barba C, De Benedictis A, Pelliccia V, et al. Beyond Broca and Wernicke: Epilepsy surgery in the language areas. Epileptic Disord. 2026. PMID 42217160. PMCID PMC13276694. DOI 10.1002/epd2.70282.; Binder JR. The Wernicke area: Modern evidence and a reinterpretation. Neurology. 2015. PMID 26567270. DOI 10.1212/wnl.0000000000002219.; Matchin W, den Ouden DB, Hickok G, Hillis AE, Bonilha L, Fridriksson J. The Wernicke conundrum revisited: evidence from connectome-based lesion-symptom mapping. Brain. 2022. PMID 35727949. DOI 10.1093/brain/awac219.; Tremblay P, Dick AS. Broca and Wernicke are dead, or moving past the classic model of language neurobiology. Brain Lang. 2016. PMID 27584714. DOI 10.1016/j.bandl.2016.08.004.; Mesulam MM, Thompson CK, Weintraub S, Rogalski EJ. The Wernicke conundrum and the anatomy of language comprehension in primary progressive aphasia. Brain. 2015. PMID 26112340. DOI 10.1093/brain/awv154.
- Desacuerdo: No hay una definición anatómica única. La clásica (Barba 2026) es la parte posterior de la circunvolución temporal superior izquierda. Binder 2015 propone las circunvoluciones del borde inferior posterior de la cisura de Silvio izquierda. Matchin 2022 propone la parte media de la temporal superior y del surco temporal superior medio y posterior. Mesulam 2015 dice que la ubicación sigue en discusión. Tremblay y Dick 2016 sostienen que no hay una definición consistente y proponen dejar el término.
