// Lógica pura del aplicador de propuestas de trazos del vago (spec 04, T6). Sin lectura ni escritura de
// archivos: eso lo hace scripts/aplicar-trazos.ts. Solo se importan tipos de src/data/tipos.ts;
// src/data/atlas.ts y src/lib/trazos.ts no se pueden importar desde Node (importan JSON sin atributo).
import type { Bilingue, ConfianzaTrazo, Marcador, PropuestaTrazo } from '../../src/data/tipos.ts';

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
}

export const RUTAS_POR_DEFECTO = {
  medidos: 'pipeline/salida/trazos-medidos.json',
  trazos: 'src/data/trazos-vago.json',
  marcadores: 'src/data/marcadores.json',
  resumen: 'docs/research/vago/resumen-trazos.md',
};

const GRUPO_VAGO = 'g-vagus-nerve-x';
const NO_ES_RAMO = 'no_es_ramo';
const GUION_LARGO = String.fromCharCode(0x2014);
const CLAVES_MEDICION = ['altura_mm', 'largo_mm', 'cerca_extremos', 'regla', 'auditoria', 'propuesta', 'confianza', 'fuente'];
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

function numero(n: number, idioma: keyof Bilingue): string {
  const t = n.toFixed(1);
  return idioma === 'es' ? t.replace('.', ',') : t;
}

function cercanas(lista: Cercana[], idioma: keyof Bilingue): string {
  return lista.map((c) => `${c.pieza} (${numero(c.mm, idioma)} mm)`).join(', ');
}

// Una frase por regla, en palabras y sin cifras de umbral: esas viven en pipeline/reglas_vago.py.
const FRASE_REGLA: Record<ReglaTrazo, Bilingue> = {
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
  sin_regla: {
    es: 'La regla no distingue entre ramos: queda sin propuesta.',
    en: 'The rule does not distinguish between branches: no proposal.',
  },
};

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
 * Evidencia bilingüe de un trazo: las medidas, la regla en palabras, la razón de la confianza y la clave de la
 * fuente. Solo repite lo que mide la regla; no agrega anatomía.
 */
export function evidenciaDeTrazo(m: Medicion): Bilingue {
  const extremo = m.regla === 'raicilla' ? 'superior' : 'inferior';
  const salida = { es: '', en: '' };
  for (const idioma of ['es', 'en'] as const) {
    const medidas =
      idioma === 'es'
        ? `Altura: de ${numero(m.altura_mm.max, idioma)} a ${numero(m.altura_mm.min, idioma)} mm. Largo: ${numero(m.largo_mm, idioma)} mm. ` +
          `Cerca del extremo superior: ${cercanas(m.cerca_extremos.superior, idioma)}. Cerca del extremo inferior: ${cercanas(m.cerca_extremos.inferior, idioma)}.`
        : `Height: from ${numero(m.altura_mm.max, idioma)} to ${numero(m.altura_mm.min, idioma)} mm. Length: ${numero(m.largo_mm, idioma)} mm. ` +
          `Near the upper end: ${cercanas(m.cerca_extremos.superior, idioma)}. Near the lower end: ${cercanas(m.cerca_extremos.inferior, idioma)}.`;
    const partes = [medidas, FRASE_REGLA[m.regla][idioma]];
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
 * se toca. Valida todo primero. Devuelve también el resumen en Markdown.
 */
export function aplicarMediciones(
  datos: { trazos: PropuestaTrazo[] },
  medidos: unknown,
  ramos: readonly string[],
): { datos: { trazos: PropuestaTrazo[] }; resumen: string } {
  if (!esObjeto(datos) || !Array.isArray(datos.trazos) || datos.trazos.some((t) => !esObjeto(t) || !textoNoVacio(t.malla))) {
    throw new Error('los trazos no son { trazos: [...] } con una malla en cada uno');
  }
  const validas = validarMediciones(medidos, datos.trazos.map((t) => t.malla), ramos);
  const salida = structuredClone(datos);
  const secciones: string[] = [];
  salida.trazos = datos.trazos.map((t): PropuestaTrazo => {
    const m = Object.hasOwn(validas, t.malla) ? validas[t.malla] : undefined;
    let nuevo: PropuestaTrazo = structuredClone(t);
    let motivo: string | null = null;
    if (!m) {
      motivo = 'no hay medición para este trazo';
    } else {
      nuevo = {
        ...nuevo,
        auditoria: m.auditoria,
        propuesta: m.propuesta,
        fuente: m.fuente,
        evidencia: evidenciaDeTrazo(m),
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
 * Argumentos del CLI: `[--medidos <ruta>] [--trazos <ruta>] [--marcadores <ruta>] [--resumen <ruta>]`, cada una una sola vez.
 * Devuelve null ante un uso indebido: bandera desconocida, sin valor, repetida, o un argumento suelto.
 */
export function argumentosAplicarTrazos(
  args: string[],
): { medidos: string; trazos: string; marcadores: string; resumen: string } | null {
  const rutas = { ...RUTAS_POR_DEFECTO };
  const puestas = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a !== '--medidos' && a !== '--trazos' && a !== '--marcadores' && a !== '--resumen') return null;
    const valor = args[i + 1];
    const clave = a.slice(2) as keyof typeof rutas;
    if (puestas.has(clave) || !valor || valor.startsWith('--')) return null;
    puestas.add(clave);
    rutas[clave] = valor;
    i++;
  }
  return rutas;
}
