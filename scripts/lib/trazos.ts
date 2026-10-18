// Lógica pura del aplicador de propuestas de trazos del vago (spec 04, T6). Sin lectura ni escritura de
// archivos: eso lo hace scripts/aplicar-trazos.ts. Solo se importan tipos de src/data/tipos.ts;
// src/data/atlas.ts y src/lib/trazos.ts no se pueden importar desde Node (importan JSON sin atributo).
import type { Bilingue, ConfianzaTrazo, Marcador, PropuestaTrazo } from '../../src/data/tipos.ts';
import type { Banda, Lado } from './asimetrias.ts';
import { TRONCO_VAGO } from './modelo.ts';

// Copia de REGLAS de pipeline/reglas_vago.py, en el mismo orden; la prueba de paridad las mantiene iguales.
export const REGLAS_TRAZO = [
  'raicilla',
  'faringeo',
  'laringeo_superior',
  'abdominal_hepatico',
  'abdominal_gastrico_anterior',
  'abdominal_gastrico_posterior',
  'abdominal_celiaco',
  'tronco',
  'sin_regla',
] as const;
export type ReglaTrazo = (typeof REGLAS_TRAZO)[number];

export interface Cercana {
  pieza: string;
  mm: number;
}

/** Una condición de una regla que no se cumple: su clave en pipeline/reglas_vago.py y el margen en mm (cero o menos). */
export interface Falla {
  condicion: string;
  mm: number;
}

/** Las condiciones que no se cumplen de una de las reglas más cercanas a un trazo sin regla. */
export interface FallaRegla {
  regla: ReglaTrazo;
  no_cumple: Falla[];
}

/** Un registro de pipeline/salida/trazos-medidos.json, tal como lo escribe `medir_trazos` de pipeline/reglas_vago.py. */
export interface Medicion {
  altura_mm: { max: number; min: number };
  largo_mm: number;
  cerca_extremos: { superior: Cercana[]; inferior: Cercana[] };
  regla: ReglaTrazo;
  auditoria: string;
  propuesta: string | null;
  confianza: ConfianzaTrazo | null;
  fuente: string;
  /** null si hay regla; en un `sin_regla`, de 1 a 2 reglas cercanas con las condiciones que fallan. */
  fallas: FallaRegla[] | null;
}

/** Un registro de pipeline/nombres-anclajes.json (lo escribe pipeline/nombrar-anclajes.py): el nombre de una pieza cercana. */
export interface NombrePieza {
  es: string;
  en: string;
  /** '' sin lado, 'l' izquierdo o 'r' derecho; el lado se escribe aparte, como en `nombrePieza` de src/lib/nombres.ts. */
  lado: '' | 'l' | 'r';
  fuente: string;
  /** Id de la pieza en la app, si ya está en ella. */
  pieza?: string;
}
export type NombresPiezas = Record<string, NombrePieza>;

/** Texto del lado entre paréntesis; es igual a `lado.izquierdo` y `lado.derecho` de src/i18n (la prueba de paridad lo comprueba). */
export const LADO: Record<keyof Bilingue, { l: string; r: string }> = {
  es: { l: 'izquierdo', r: 'derecho' },
  en: { l: 'left', r: 'right' },
};

export const RUTAS_POR_DEFECTO = {
  medidos: 'pipeline/salida/trazos-medidos.json',
  trazos: 'src/data/trazos-vago.json',
  marcadores: 'src/data/marcadores.json',
  resumen: 'docs/research/vago/resumen-trazos.md',
  rutas: 'public/modelos/rutas-vago.json',
  nombres: 'pipeline/nombres-anclajes.json',
};

const GRUPO_VAGO = 'g-vagus-nerve-x';
const NO_ES_RAMO = 'no_es_ramo';
const GUION_LARGO = String.fromCharCode(0x2014);
const CLAVES_MEDICION = ['altura_mm', 'largo_mm', 'cerca_extremos', 'regla', 'auditoria', 'propuesta', 'confianza', 'fuente', 'fallas'];
const NIVELES: readonly string[] = ['alta', 'media', 'baja'];

/** Ids de los ramos que se pueden proponer: los marcadores del vago menos el foramen yugular (igual que `ramosDeTrazo` de src/lib/trazos.ts). */
export function ramosDeMarcadores(m: readonly Marcador[]): string[] {
  return m.filter((x) => x.padre === GRUPO_VAGO && x.id !== 'm-jugular-foramen').map((x) => x.id);
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function finito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// Las condiciones de cada regla, con la clave que les da pipeline/reglas_vago.py (`_condiciones_*`). tronco y sin_regla no tienen.
const CONDICIONES_ABDOMEN = ['bajo_hiato', 'destino_mas_cercano', 'cerca_destino'];
const CONDICIONES: Partial<Record<ReglaTrazo, readonly string[]>> = {
  raicilla: ['largo', 'cerca_bulbo', 'detras_oliva', 'sobre_foramen'],
  faringeo: ['bajo_foramen_min', 'bajo_foramen_max', 'mas_cerca_faringe', 'cerca_faringe', 'cara_posterior_faringe'],
  laringeo_superior: ['bajo_foramen_min', 'bajo_foramen_max', 'mas_cerca_tiroides', 'cerca_tiroides'],
  abdominal_hepatico: CONDICIONES_ABDOMEN,
  abdominal_celiaco: CONDICIONES_ABDOMEN,
  abdominal_gastrico_anterior: [...CONDICIONES_ABDOMEN, 'cara_estomago'],
  abdominal_gastrico_posterior: [...CONDICIONES_ABDOMEN, 'cara_estomago'],
};

function validarFallas(malla: string, v: unknown): void {
  if (!Array.isArray(v) || v.length < 1 || v.length > 2) throw new Error(`${malla}: fallas debe traer 1 o 2 reglas en un trazo sin regla`);
  const vistas = new Set<string>();
  for (const f of v as unknown[]) {
    if (!esObjeto(f) || Object.keys(f).sort().join() !== 'no_cumple,regla') {
      throw new Error(`${malla}: fallas debe traer solo { regla, no_cumple }`);
    }
    const regla = f['regla'];
    const claves = typeof regla === 'string' ? CONDICIONES[regla as ReglaTrazo] : undefined;
    if (typeof regla !== 'string' || claves === undefined) {
      throw new Error(`${malla}: fallas trae una regla que no tiene condiciones: ${JSON.stringify(regla) ?? 'undefined'}`);
    }
    if (vistas.has(regla)) throw new Error(`${malla}: fallas repite la regla ${regla}`);
    vistas.add(regla);
    const lista = f['no_cumple'];
    if (!Array.isArray(lista) || lista.length < 1) throw new Error(`${malla}: fallas.${regla} debe traer al menos una condición que no se cumple`);
    const condiciones = new Set<string>();
    for (const c of lista as unknown[]) {
      if (!esObjeto(c) || Object.keys(c).sort().join() !== 'condicion,mm') {
        throw new Error(`${malla}: fallas.${regla} debe traer solo { condicion, mm }`);
      }
      const condicion = c['condicion'];
      if (typeof condicion !== 'string' || !claves.includes(condicion)) {
        throw new Error(`${malla}: fallas.${regla} trae una condición que no es de esa regla: ${JSON.stringify(condicion) ?? 'undefined'}`);
      }
      if (condiciones.has(condicion)) throw new Error(`${malla}: fallas.${regla} repite la condición ${condicion}`);
      condiciones.add(condicion);
      if (!finito(c['mm']) || c['mm'] > 0) throw new Error(`${malla}: fallas.${regla}.${condicion} debe traer un margen finito menor o igual a 0`);
    }
  }
}

function validarCercanas(malla: string, extremo: string, v: unknown): void {
  if (!Array.isArray(v) || v.length < 1 || v.length > 2) throw new Error(`${malla}: cerca_extremos.${extremo} debe traer 1 o 2 piezas`);
  for (const c of v as unknown[]) {
    if (!esObjeto(c) || Object.keys(c).sort().join() !== 'mm,pieza') {
      throw new Error(`${malla}: cerca_extremos.${extremo} debe traer solo { pieza, mm }`);
    }
    if (!textoNoVacio(c['pieza'])) throw new Error(`${malla}: cerca_extremos.${extremo} trae una pieza sin nombre`);
    if (!finito(c['mm']) || c['mm'] < 0) throw new Error(`${malla}: cerca_extremos.${extremo} trae una distancia que no es un número mayor o igual a 0`);
  }
}

/**
 * Valida el archivo de mediciones completo antes de aplicar nada. Lanza un Error con "<malla>: <problema>"
 * ante el primer problema, o con un mensaje general si la entrada no es un objeto.
 */
export function validarMediciones(datos: unknown, mallas: readonly string[], ramos: readonly string[]): Record<string, Medicion> {
  if (!esObjeto(datos)) throw new Error('la entrada no es un objeto de mediciones por malla');
  const conocidas = new Set(mallas);
  for (const [malla, m] of Object.entries(datos)) {
    if (!conocidas.has(malla)) throw new Error(`${malla}: malla desconocida, no está en trazos-vago.json`);
    if (!esObjeto(m)) throw new Error(`${malla}: la medición no es un objeto`);
    for (const k of Object.keys(m)) {
      if (!CLAVES_MEDICION.includes(k)) throw new Error(`${malla}: clave desconocida "${k}"`);
    }
    for (const k of CLAVES_MEDICION) {
      if (!(k in m)) throw new Error(`${malla}: falta la clave "${k}"`);
    }
    const altura = m['altura_mm'];
    if (!esObjeto(altura) || Object.keys(altura).sort().join() !== 'max,min' || !finito(altura['max']) || !finito(altura['min'])) {
      throw new Error(`${malla}: altura_mm debe ser { max, min } con números finitos`);
    }
    if (altura['max'] < altura['min']) throw new Error(`${malla}: altura_mm.max es menor que altura_mm.min`);
    if (!finito(m['largo_mm']) || m['largo_mm'] < 0) throw new Error(`${malla}: largo_mm debe ser un número finito mayor o igual a 0`);
    const cerca = m['cerca_extremos'];
    if (!esObjeto(cerca) || Object.keys(cerca).sort().join() !== 'inferior,superior') {
      throw new Error(`${malla}: cerca_extremos debe ser { superior, inferior }`);
    }
    validarCercanas(malla, 'superior', cerca['superior']);
    validarCercanas(malla, 'inferior', cerca['inferior']);
    const regla = m['regla'];
    if (typeof regla !== 'string' || !(REGLAS_TRAZO as readonly string[]).includes(regla)) {
      throw new Error(`${malla}: regla desconocida ${JSON.stringify(regla) ?? 'undefined'}`);
    }
    if (!textoNoVacio(m['auditoria'])) throw new Error(`${malla}: auditoria debe ser texto no vacío`);
    if (!textoNoVacio(m['fuente'])) throw new Error(`${malla}: fuente debe ser texto no vacío`);
    // Todo texto de la medición llega a trazos-vago.json: ninguno lleva el guion largo.
    const textos = [m['auditoria'], m['fuente'], ...[cerca['superior'], cerca['inferior']].flatMap((l) => (l as Cercana[]).map((c) => c.pieza))];
    if (textos.some((s) => s.includes(GUION_LARGO))) throw new Error(`${malla}: la medición trae un guion largo (U+2014)`);
    const propuesta = m['propuesta'];
    if (propuesta !== null && propuesta !== NO_ES_RAMO && !(typeof propuesta === 'string' && ramos.includes(propuesta))) {
      throw new Error(`${malla}: propuesta ${JSON.stringify(propuesta) ?? 'undefined'} no es null, "${NO_ES_RAMO}" ni un ramo de la lista`);
    }
    if (regla === 'sin_regla') {
      if (propuesta !== null) throw new Error(`${malla}: la regla sin_regla no puede traer propuesta`);
    } else if (propuesta === null) {
      throw new Error(`${malla}: la regla ${regla} debe traer propuesta`);
    } else if (regla === 'raicilla' || regla === 'tronco') {
      if (propuesta !== NO_ES_RAMO) throw new Error(`${malla}: la regla ${regla} propone "${NO_ES_RAMO}", no ${JSON.stringify(propuesta)}`);
    } else if (propuesta === NO_ES_RAMO) {
      throw new Error(`${malla}: la regla ${regla} propone un ramo de la lista, no "${NO_ES_RAMO}"`);
    }
    // Con regla, `fallas` es null; sin regla, dice qué condiciones de las reglas más cercanas no se cumplen.
    if (regla === 'sin_regla') validarFallas(malla, m['fallas']);
    else if (m['fallas'] !== null) throw new Error(`${malla}: con la regla ${regla}, fallas debe ser null`);
    const confianza = m['confianza'];
    if (propuesta === null) {
      if (confianza !== null) throw new Error(`${malla}: sin propuesta, confianza debe ser null`);
    } else if (typeof confianza !== 'string' || !NIVELES.includes(confianza)) {
      throw new Error(`${malla}: con propuesta, confianza debe ser alta, media o baja`);
    } else if (confianza !== 'baja') {
      // La razón de alta y media compara la segunda pieza más cercana con la primera, en el extremo que usa la regla.
      const extremo = regla === 'raicilla' ? 'superior' : 'inferior';
      if ((cerca[extremo] as Cercana[]).length < 2) {
        throw new Error(`${malla}: confianza ${confianza} necesita dos piezas cerca del extremo ${extremo}`);
      }
    }
  }
  return datos as unknown as Record<string, Medicion>;
}

/**
 * Valida la tabla de nombres de pipeline/nombres-anclajes.json (`{ piezas: { malla: { es, en, lado, fuente, pieza? } } }`).
 * Lanza un Error con la malla ante el primer problema. Devuelve la tabla `piezas`.
 */
export function validarNombresPiezas(datos: unknown): NombresPiezas {
  if (!esObjeto(datos) || !esObjeto(datos['piezas'])) throw new Error('los nombres de las piezas no son { piezas: { ... } }');
  for (const [malla, n] of Object.entries(datos['piezas'])) {
    if (!esObjeto(n)) throw new Error(`${malla}: el nombre de la pieza no es un objeto`);
    const claves = Object.keys(n).sort().join();
    if (claves !== 'en,es,fuente,lado' && claves !== 'en,es,fuente,lado,pieza') {
      throw new Error(`${malla}: el nombre de la pieza debe traer es, en, lado, fuente y, si está en la app, pieza`);
    }
    for (const k of ['es', 'en', 'fuente'] as const) {
      if (!textoNoVacio(n[k])) throw new Error(`${malla}: ${k} debe ser texto no vacío`);
      if (n[k].includes(GUION_LARGO)) throw new Error(`${malla}: ${k} trae un guion largo (U+2014)`);
    }
    if (n['es'] === 'PENDIENTE' || n['en'] === 'PENDIENTE') throw new Error(`${malla}: la pieza no tiene nombre (PENDIENTE)`);
    if (n['lado'] !== '' && n['lado'] !== 'l' && n['lado'] !== 'r') throw new Error(`${malla}: lado debe ser "", "l" o "r"`);
    if ('pieza' in n && !textoNoVacio(n['pieza'])) throw new Error(`${malla}: pieza debe ser texto no vacío`);
  }
  return datos['piezas'] as unknown as NombresPiezas;
}

/**
 * Nombre de una pieza cercana en la evidencia: el de la tabla y, si tiene lado, "(izquierdo)" o "(derecho)" como lo
 * escribe `nombrePieza` de src/lib/nombres.ts ("Oliva (izquierdo)", "Olive (left)"). Lanza si la pieza no tiene nombre.
 */
export function nombrePiezaEvidencia(pieza: string, nombres: NombresPiezas, idioma: keyof Bilingue): string {
  const n = Object.hasOwn(nombres, pieza) ? nombres[pieza] : undefined;
  if (n === undefined) throw new Error(`la pieza "${pieza}" no tiene nombre en la tabla de nombres`);
  return n.lado === '' ? n[idioma] : `${n[idioma]} (${LADO[idioma][n.lado]})`;
}

function numero(n: number, idioma: keyof Bilingue): string {
  const t = n.toFixed(1);
  return idioma === 'es' ? t.replace('.', ',') : t;
}

/**
 * Frase de banda de un trazo del tronco escaneado (ADR 0010): el atlas publicado retira de ese trazo lo que
 * cae dentro de la banda de su lado, y las medidas siguen siendo las del trazo de Z-Anatomy sin cortar.
 * Las alturas salen de la banda y de la medición; lanza si la banda no corta el trazo como se espera.
 */
function fraseBanda(malla: string, m: Medicion, banda: Banda, idioma: keyof Bilingue): string {
  const arriba = banda.y_max * 1000;
  const abajo = banda.y_min === null ? null : banda.y_min * 1000;
  const { max, min } = m.altura_mm;
  if (!(max > arriba && min < (abajo ?? arriba))) {
    throw new Error(`${malla}: la banda del vago ${banda.lado} no corta el trazo (de ${numero(max, 'en')} a ${numero(min, 'en')} mm)`);
  }
  const A = numero(arriba, idioma);
  const MAX = numero(max, idioma);
  if (abajo === null) {
    return idioma === 'es'
      ? `En el atlas publicado se retira lo que este trazo tiene por debajo de ${A} mm (ADR 0010): el tramo torácico está pendiente de trazado y ahí queda un hueco. ` +
          `Lo publicado va de ${MAX} a ${A} mm. Las medidas anteriores son las del trazo de Z-Anatomy sin cortar.`
      : `In the published atlas, the part of this trace below ${A} mm is removed (ADR 0010): the thoracic segment is pending tracing and a gap is left there. ` +
          `What is published runs from ${MAX} to ${A} mm. The earlier measurements are those of the uncut Z-Anatomy trace.`;
  }
  const B = numero(abajo, idioma);
  const MIN = numero(min, idioma);
  return idioma === 'es'
    ? `En el atlas publicado se retira lo que este trazo tiene entre ${A} y ${B} mm (ADR 0010): el tramo torácico está pendiente de trazado y ahí queda un hueco. ` +
        `Lo publicado queda en dos partes, de ${MAX} a ${A} mm y de ${B} a ${MIN} mm. Las medidas anteriores son las del trazo de Z-Anatomy sin cortar.`
    : `In the published atlas, the part of this trace between ${A} and ${B} mm is removed (ADR 0010): the thoracic segment is pending tracing and a gap is left there. ` +
        `What is published stays in two parts, from ${MAX} to ${A} mm and from ${B} to ${MIN} mm. The earlier measurements are those of the uncut Z-Anatomy trace.`;
}

function cercanas(lista: Cercana[], nombres: NombresPiezas, idioma: keyof Bilingue): string {
  return lista.map((c) => `${nombrePiezaEvidencia(c.pieza, nombres, idioma)} (${numero(c.mm, idioma)} mm)`).join(', ');
}

// Una frase por regla, en palabras y sin cifras de umbral: esas viven en pipeline/reglas_vago.py.
const FRASE_REGLA: Record<Exclude<ReglaTrazo, 'sin_regla'>, Bilingue> = {
  raicilla: {
    es: 'Raicilla: trazo corto cuyo extremo superior queda junto a la superficie del bulbo y por detrás de la oliva, y todo el trazo queda por encima del foramen yugular; se propone que no es un ramo.',
    en: 'Rootlet: short trace whose upper end lies next to the surface of the medulla and dorsal to the olive, and the whole trace lies above the jugular foramen; it is proposed not to be a branch.',
  },
  faringeo: {
    es: 'Regla del ramo faríngeo: el extremo superior queda, medido a lo largo del tronco, a la distancia bajo el foramen yugular que da la fuente; el extremo inferior queda cerca de la faringe, más cerca de ella que del cartílago tiroides y en su cara posterior.',
    en: 'Pharyngeal branch rule: the upper end lies, measured along the trunk, at the distance below the jugular foramen given by the source; the lower end lies near the pharynx, closer to it than to the thyroid cartilage and on its posterior side.',
  },
  laringeo_superior: {
    es: 'Regla del nervio laríngeo superior: el extremo superior queda, medido a lo largo del tronco, a la distancia bajo el foramen yugular que da la fuente; el extremo inferior queda cerca del cartílago tiroides, más cerca de él que de la faringe.',
    en: 'Superior laryngeal nerve rule: the upper end lies, measured along the trunk, at the distance below the jugular foramen given by the source; the lower end lies near the thyroid cartilage, closer to it than to the pharynx.',
  },
  abdominal_hepatico: {
    es: 'Regla del ramo hepático: todo el trazo queda por debajo del hiato esofágico y su extremo inferior queda cerca del hígado, más cerca de él que de las otras piezas de destino.',
    en: 'Hepatic branch rule: the whole trace lies below the oesophageal hiatus and its lower end lies near the liver, closer to it than to the other target pieces.',
  },
  abdominal_gastrico_anterior: {
    es: 'Regla del ramo gástrico anterior: todo el trazo queda por debajo del hiato esofágico y su extremo inferior queda cerca del estómago, más cerca de él que de las otras piezas de destino, en su cara anterior, en el vago izquierdo.',
    en: 'Anterior gastric branch rule: the whole trace lies below the oesophageal hiatus and its lower end lies near the stomach, closer to it than to the other target pieces, on its anterior side, in the left vagus.',
  },
  abdominal_gastrico_posterior: {
    es: 'Regla del ramo gástrico posterior: todo el trazo queda por debajo del hiato esofágico y su extremo inferior queda cerca del estómago, más cerca de él que de las otras piezas de destino, en su cara posterior, en el vago derecho.',
    en: 'Posterior gastric branch rule: the whole trace lies below the oesophageal hiatus and its lower end lies near the stomach, closer to it than to the other target pieces, on its posterior side, in the right vagus.',
  },
  abdominal_celiaco: {
    es: 'Regla del ramo celíaco: todo el trazo queda por debajo del hiato esofágico y su extremo inferior queda cerca de la aorta torácica, más cerca de ella que de las otras piezas de destino.',
    en: 'Coeliac branch rule: the whole trace lies below the oesophageal hiatus and its lower end lies near the thoracic aorta, closer to it than to the other target pieces.',
  },
  tronco: {
    es: 'Regla del tronco: el largo del trazo supera el máximo de un ramo; se propone que no es un ramo.',
    en: 'Trunk rule: the length of the trace exceeds the maximum for a branch; it is proposed not to be a branch.',
  },
};

// Cómo se llama cada regla que puede salir como la más cercana de un trazo sin regla.
const NOMBRE_REGLA: Partial<Record<ReglaTrazo, Bilingue>> = {
  raicilla: { es: 'la de la raicilla', en: 'the rootlet rule' },
  faringeo: { es: 'la del ramo faríngeo', en: 'the pharyngeal branch rule' },
  laringeo_superior: { es: 'la del nervio laríngeo superior', en: 'the superior laryngeal nerve rule' },
  abdominal_hepatico: { es: 'la del ramo hepático', en: 'the hepatic branch rule' },
  abdominal_gastrico_anterior: { es: 'la del ramo gástrico anterior', en: 'the anterior gastric branch rule' },
  abdominal_gastrico_posterior: { es: 'la del ramo gástrico posterior', en: 'the posterior gastric branch rule' },
  abdominal_celiaco: { es: 'la del ramo celíaco', en: 'the coeliac branch rule' },
};

// El destino que mide cada regla abdominal, con la preposición que pide la frase en español.
const ABDOMEN_DESTINO: Record<string, { es: string; en: string }> = {
  abdominal_hepatico: { es: 'del hígado', en: 'the liver' },
  abdominal_celiaco: { es: 'de la aorta torácica', en: 'the thoracic aorta' },
  abdominal_gastrico_anterior: { es: 'del estómago', en: 'the stomach' },
  abdominal_gastrico_posterior: { es: 'del estómago', en: 'the stomach' },
};

// Lo que exige cada condición, en palabras y sin cifras de umbral (esas viven en pipeline/reglas_vago.py).
function exigencia(regla: ReglaTrazo, condicion: string, idioma: keyof Bilingue): string {
  const destino = ABDOMEN_DESTINO[regla];
  const cara = regla === 'abdominal_gastrico_anterior' ? { es: 'anterior', en: 'anterior' } : { es: 'posterior', en: 'posterior' };
  const frases: Record<string, Bilingue> = {
    largo: { es: 'el trazo sea tan corto como una raicilla', en: 'the trace is as short as a rootlet' },
    cerca_bulbo: { es: 'su extremo superior quede junto a la superficie del bulbo', en: 'its upper end lies next to the surface of the medulla' },
    detras_oliva: { es: 'su extremo superior quede por detrás de la oliva', en: 'its upper end lies dorsal to the olive' },
    sobre_foramen: { es: 'todo el trazo quede por encima del foramen yugular', en: 'the whole trace lies above the jugular foramen' },
    bajo_foramen_min: {
      es: 'su extremo superior quede, a lo largo del tronco, por lo menos a la distancia mínima bajo el foramen yugular',
      en: 'its upper end lies, measured along the trunk, at least the minimum distance below the jugular foramen',
    },
    bajo_foramen_max: {
      es: 'su extremo superior quede, a lo largo del tronco, como máximo a la distancia máxima bajo el foramen yugular',
      en: 'its upper end lies, measured along the trunk, at most the maximum distance below the jugular foramen',
    },
    mas_cerca_faringe: { es: 'su extremo inferior quede más cerca de la faringe que del cartílago tiroides', en: 'its lower end lies closer to the pharynx than to the thyroid cartilage' },
    cerca_faringe: { es: 'su extremo inferior quede cerca de la faringe', en: 'its lower end lies near the pharynx' },
    cara_posterior_faringe: { es: 'su extremo inferior quede en la cara posterior de la faringe', en: 'its lower end lies on the posterior side of the pharynx' },
    mas_cerca_tiroides: { es: 'su extremo inferior quede más cerca del cartílago tiroides que de la faringe', en: 'its lower end lies closer to the thyroid cartilage than to the pharynx' },
    cerca_tiroides: { es: 'su extremo inferior quede cerca del cartílago tiroides', en: 'its lower end lies near the thyroid cartilage' },
    bajo_hiato: { es: 'todo el trazo quede por debajo del hiato esofágico', en: 'the whole trace lies below the oesophageal hiatus' },
    destino_mas_cercano: {
      es: `su extremo inferior quede más cerca ${destino?.es ?? ''} que de las otras piezas de destino`,
      en: `its lower end lies closer to ${destino?.en ?? ''} than to the other target pieces`,
    },
    cerca_destino: { es: `su extremo inferior quede cerca ${destino?.es ?? ''}`, en: `its lower end lies near ${destino?.en ?? ''}` },
    cara_estomago: { es: `su extremo inferior quede en la cara ${cara.es} del estómago`, en: `its lower end lies on the ${cara.en} side of the stomach` },
  };
  const f = frases[condicion];
  if (f === undefined) throw new Error(`la condición ${condicion} de la regla ${regla} no tiene frase`);
  return f[idioma];
}

function margenFalla(mm: number, idioma: keyof Bilingue): string {
  const menos = idioma === 'es' ? 'por menos de 0,1 mm' : 'by less than 0.1 mm';
  if (Math.abs(mm) < 0.05) return idioma === 'es' ? `falla ${menos}` : `fails ${menos}`;
  return idioma === 'es' ? `falla por ${numero(Math.abs(mm), idioma)} mm` : `fails by ${numero(Math.abs(mm), idioma)} mm`;
}

function fallasDe(f: FallaRegla, idioma: keyof Bilingue): string {
  const items = f.no_cumple.map((c) => `${exigencia(f.regla, c.condicion, idioma)} (${margenFalla(c.mm, idioma)})`);
  if (idioma === 'es') {
    const con = items.map((i) => `que ${i}`);
    const ultimo = con.pop()!;
    return `no se cumple ${con.length > 0 ? `${con.join(', ')} y ${ultimo}` : ultimo}`;
  }
  return `not met: ${items.join('; ')}`;
}

/**
 * Frase de un trazo sin regla: ninguna se cumple y queda sin propuesta, la regla o las dos reglas más cercanas (el criterio
 * de región lo aplica `fallas` de pipeline/reglas_vago.py y viene en la medición) y cada condición que falla con su margen.
 */
function fraseSinRegla(m: Medicion, idioma: keyof Bilingue): string {
  const fallas = m.fallas;
  if (fallas === null || fallas.length === 0) throw new Error('un trazo sin regla necesita fallas');
  const nombreDe = (f: FallaRegla): string => {
    const n = NOMBRE_REGLA[f.regla];
    if (n === undefined) throw new Error(`la regla ${f.regla} no tiene nombre en las fallas`);
    return n[idioma];
  };
  const inicio = idioma === 'es' ? 'Ninguna regla se cumple: queda sin propuesta.' : 'No rule is met: no proposal.';
  if (fallas.length === 1) {
    const f = fallas[0]!;
    return idioma === 'es'
      ? `${inicio} Por la altura media del trazo, la regla más cercana es ${nombreDe(f)}; ${fallasDe(f, idioma)}.`
      : `${inicio} By the trace's mean height, the closest rule is ${nombreDe(f)}; ${fallasDe(f, idioma)}.`;
  }
  const [a, b] = [fallas[0]!, fallas[1]!];
  return idioma === 'es'
    ? `${inicio} Por la altura media del trazo, las reglas más cercanas son ${nombreDe(a)} y ${nombreDe(b)}. En ${nombreDe(a)}, ${fallasDe(a, idioma)}. En ${nombreDe(b)}, ${fallasDe(b, idioma)}.`
    : `${inicio} By the trace's mean height, the closest rules are ${nombreDe(a)} and ${nombreDe(b)}. In ${nombreDe(a)}, ${fallasDe(a, idioma)}. In ${nombreDe(b)}, ${fallasDe(b, idioma)}.`;
}

function razonConfianza(nivel: ConfianzaTrazo, extremo: 'superior' | 'inferior', idioma: keyof Bilingue): string {
  if (idioma === 'es') {
    if (nivel === 'baja') return 'Confianza baja: alguna medida de la regla queda a menos de 3 mm de su umbral.';
    return (
      `Confianza ${nivel}: ninguna medida de la regla queda a menos de 3 mm de su umbral y, en el extremo ${extremo}, ` +
      `la segunda pieza más cercana está a ${nivel === 'alta' ? 'más del doble' : 'no más del doble'} de distancia que la primera.`
    );
  }
  if (nivel === 'baja') return 'Low confidence: some measure of the rule is less than 3 mm from its threshold.';
  const nombre = nivel === 'alta' ? 'High' : 'Medium';
  return (
    `${nombre} confidence: no measure of the rule is less than 3 mm from its threshold and, at the ${extremo === 'superior' ? 'upper' : 'lower'} end, ` +
    `the second closest piece is ${nivel === 'alta' ? 'more than twice' : 'no more than twice'} as far as the first.`
  );
}

/**
 * Evidencia bilingüe de un trazo: las medidas con las piezas cercanas por su nombre en la app (`nombres`), la frase de
 * banda si el trazo es un tronco cortado (`banda`), la regla en palabras (o, sin regla, la regla más cercana con cada
 * condición que falla), la razón de la confianza y la clave de la fuente. Traduce nombres con la tabla y repite lo que
 * mide la regla y lo que corta la banda; no agrega anatomía.
 */
export function evidenciaDeTrazo(m: Medicion, nombres: NombresPiezas, banda?: { malla: string; banda: Banda }): Bilingue {
  const extremo = m.regla === 'raicilla' ? 'superior' : 'inferior';
  const salida = { es: '', en: '' };
  for (const idioma of ['es', 'en'] as const) {
    const medidas =
      idioma === 'es'
        ? `Altura: de ${numero(m.altura_mm.max, idioma)} a ${numero(m.altura_mm.min, idioma)} mm. Largo: ${numero(m.largo_mm, idioma)} mm. ` +
          `Cerca del extremo superior: ${cercanas(m.cerca_extremos.superior, nombres, idioma)}. Cerca del extremo inferior: ${cercanas(m.cerca_extremos.inferior, nombres, idioma)}.`
        : `Height: from ${numero(m.altura_mm.max, idioma)} to ${numero(m.altura_mm.min, idioma)} mm. Length: ${numero(m.largo_mm, idioma)} mm. ` +
          `Near the upper end: ${cercanas(m.cerca_extremos.superior, nombres, idioma)}. Near the lower end: ${cercanas(m.cerca_extremos.inferior, nombres, idioma)}.`;
    const partes = [medidas];
    if (banda) partes.push(fraseBanda(banda.malla, m, banda.banda, idioma));
    partes.push(m.regla === 'sin_regla' ? fraseSinRegla(m, idioma) : FRASE_REGLA[m.regla][idioma]);
    if (m.confianza !== null) partes.push(razonConfianza(m.confianza, extremo, idioma));
    partes.push(idioma === 'es' ? `Fuente: ${m.fuente}.` : `Source: ${m.fuente}.`);
    salida[idioma] = partes.join(' ');
  }
  return salida;
}

/** Texto de `trazos-vago.json`: sangría de 2 espacios y un solo salto final, igual que el archivo actual. */
export function serializarTrazos(d: { trazos: PropuestaTrazo[] }): string {
  return `${JSON.stringify(d, null, 2)}\n`;
}

function describir(t: PropuestaTrazo): string {
  const propuesta = t.propuesta === null ? 'ninguna' : t.propuesta;
  const confianza = t.confianza === undefined ? 'sin dato' : t.confianza === null ? 'ninguna' : t.confianza;
  return `propuesta ${propuesta}; confianza ${confianza}; auditoria "${t.auditoria}"`;
}

/**
 * Lleva las mediciones a los trazos. Pura: no muta la entrada. Solo cambian `auditoria`, `propuesta`, `fuente`,
 * `evidencia` y `confianza`; `malla`, el orden y cualquier otra clave quedan iguales, y un trazo sin medición no
 * se toca. Valida todo primero, incluido que cada pieza cercana de cada medición tenga nombre en `nombres`. Devuelve también el resumen en Markdown. Si la medición es de un tronco escaneado
 * (`TRONCO_VAGO`), la evidencia lleva la frase de la banda de su lado, que sale de `bandas`.
 */
export function aplicarMediciones(
  datos: { trazos: PropuestaTrazo[] },
  medidos: unknown,
  ramos: readonly string[],
  bandas: readonly Banda[],
  nombres: unknown,
): { datos: { trazos: PropuestaTrazo[] }; resumen: string } {
  if (!esObjeto(datos) || !Array.isArray(datos.trazos) || datos.trazos.some((t) => !esObjeto(t) || !textoNoVacio(t.malla))) {
    throw new Error('los trazos no son { trazos: [...] } con una malla en cada uno');
  }
  const validas = validarMediciones(medidos, datos.trazos.map((t) => t.malla), ramos);
  const tabla = validarNombresPiezas(nombres);
  for (const [malla, m] of Object.entries(validas)) {
    for (const c of [...m.cerca_extremos.superior, ...m.cerca_extremos.inferior]) {
      if (!Object.hasOwn(tabla, c.pieza)) throw new Error(`${malla}: la pieza "${c.pieza}" no tiene nombre en la tabla de nombres`);
    }
  }
  const salida = structuredClone(datos);
  const secciones: string[] = [];
  salida.trazos = datos.trazos.map((t): PropuestaTrazo => {
    const m = Object.hasOwn(validas, t.malla) ? validas[t.malla] : undefined;
    let nuevo: PropuestaTrazo = structuredClone(t);
    let motivo: string | null = null;
    if (!m) {
      motivo = 'no hay medición para este trazo';
    } else {
      const lado = (Object.keys(TRONCO_VAGO) as Lado[]).find((l) => TRONCO_VAGO[l] === t.malla);
      let banda: { malla: string; banda: Banda } | undefined;
      if (lado !== undefined) {
        const delLado = bandas.find((b) => b.lado === lado);
        if (!delLado) throw new Error(`${t.malla}: falta la banda del vago ${lado}`);
        banda = { malla: t.malla, banda: delLado };
      }
      nuevo = {
        ...nuevo,
        auditoria: m.auditoria,
        propuesta: m.propuesta,
        fuente: m.fuente,
        evidencia: evidenciaDeTrazo(m, tabla, banda),
        confianza: m.confianza,
      };
      if (JSON.stringify(nuevo) === JSON.stringify(t)) motivo = 'la medición coincide con lo que ya tiene el trazo';
    }
    const lineas = [
      `## ${t.malla}`,
      '',
      `- Resultado: ${motivo === null ? 'actualizado' : 'sin cambios'}`,
      `- Antes: ${describir(t)}`,
      `- Después: ${describir(nuevo)}`,
      `- Regla: ${m ? m.regla : 'sin medición'}`,
      `- Fuente: ${m ? m.fuente : 'sin medición'}`,
    ];
    if (motivo !== null) lineas.push(`- Motivo: ${motivo}`);
    secciones.push(lineas.join('\n'));
    return nuevo;
  });
  const cabecera = [
    '# Resumen de las propuestas de trazos',
    '',
    'Lo escribe `node scripts/aplicar-trazos.ts` a partir de las mediciones de `pipeline/auditar-vago.py`. Toda propuesta es para revisión docente: ningún nombre es definitivo.',
  ].join('\n');
  const resumen = `${cabecera}\n\n${secciones.join('\n\n')}\n`;
  if (serializarTrazos(salida).includes(GUION_LARGO) || resumen.includes(GUION_LARGO)) {
    throw new Error('la salida trae un guion largo (U+2014); el texto no debe llevarlo');
  }
  return { datos: salida, resumen };
}

/**
 * Argumentos del CLI: `[--medidos <ruta>] [--trazos <ruta>] [--marcadores <ruta>] [--resumen <ruta>] [--rutas <ruta>] [--nombres <ruta>]`, cada una una sola vez.
 * Devuelve null ante un uso indebido: bandera desconocida, sin valor, repetida, o un argumento suelto.
 */
export function argumentosAplicarTrazos(
  args: string[],
): { medidos: string; trazos: string; marcadores: string; resumen: string; rutas: string; nombres: string } | null {
  const rutas = { ...RUTAS_POR_DEFECTO };
  const puestas = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a !== '--medidos' && a !== '--trazos' && a !== '--marcadores' && a !== '--resumen' && a !== '--rutas' && a !== '--nombres') return null;
    const valor = args[i + 1];
    const clave = a.slice(2) as keyof typeof rutas;
    if (puestas.has(clave) || !valor || valor.startsWith('--')) return null;
    puestas.add(clave);
    rutas[clave] = valor;
    i++;
  }
  return rutas;
}
