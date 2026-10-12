// Inventario (F6): el último tramo del deslizador acomoda los bloques en repisas sobre el plano frontal.
// Igual que la explosión radial, solo produce desplazamientos; la posición original no se toca.
import { desplazamientosExplosion, escalar, origenExplosion, promedio, sumar, restar, type Lado, type Vec3 } from './explosion';

/** Fracción del deslizador donde termina la explosión radial (ahí llega a su factor 1) y empieza el inventario. */
export const INICIO_INVENTARIO = 0.7;
/** Espacio entre bloques y entre filas del inventario, en metros. */
export const SEPARACION_INVENTARIO = 0.008;
/** Lado mínimo de un bloque en el inventario, para que una pieza diminuta (o sin caja) no quede pegada a la vecina. */
export const TAMANO_MINIMO = 0.004;
/** Ancho de cada lado del inventario respecto a la raíz de su área: más de 1 da repisas más anchas que altas. */
const PROPORCION_LADO = 1;
/** Lo mismo para la columna de la línea media, más angosta para que los lados queden cerca del centro. */
const PROPORCION_MEDIO = 0.8;

/** Caja de una pieza en el mundo: [mínimo, máximo]. */
export type Caja = [Vec3, Vec3];

interface Elemento {
  clave: string;
  orden: string; // clave sin el sufijo de lado: la izquierda y la derecha se ordenan igual y quedan en espejo
  grupo: string;
  centro: Vec3; // centro de la caja del bloque
  ancho: number; // tamaño en X
  alto: number; // tamaño en Y
}

/** Posición relativa de cada elemento en una región: x desde el borde que da a la línea media, y hacia abajo desde arriba. */
interface Acomodo {
  pos: Map<string, [number, number]>;
  ancho: number;
  alto: number;
}

/**
 * Repisas: los elementos se ponen en fila hasta llenar el ancho; cada grupo (lóbulo) empieza fila nueva.
 * Los elementos llegan ya ordenados.
 */
function acomodar(elementos: Elemento[], anchoMaximo: number): Acomodo {
  const pos = new Map<string, [number, number]>();
  const g = SEPARACION_INVENTARIO;
  let x = 0;
  let arriba = 0;
  let altoFila = 0;
  let grupo: string | null = null;
  let fila: Elemento[] = [];
  let ancho = 0;
  const cerrarFila = () => {
    for (const e of fila) {
      const p = pos.get(e.clave)!;
      pos.set(e.clave, [p[0], arriba + altoFila / 2]);
    }
    if (fila.length) arriba += altoFila + g;
    fila = [];
    altoFila = 0;
    x = 0;
  };
  for (const e of elementos) {
    const lleno = fila.length > 0 && x + e.ancho > anchoMaximo;
    // Un grupo nuevo empieza fila solo si la actual ya va por la mitad; si no, se queda al lado y no deja huecos.
    const otroGrupo = grupo !== null && e.grupo !== grupo && x >= anchoMaximo / 2;
    if (lleno || otroGrupo) cerrarFila();
    grupo = e.grupo;
    pos.set(e.clave, [x + e.ancho / 2, 0]);
    x += e.ancho + g;
    ancho = Math.max(ancho, x - g);
    altoFila = Math.max(altoFila, e.alto);
    fila.push(e);
  }
  cerrarFila();
  return { pos, ancho, alto: Math.max(0, arriba - g) };
}

function anchoObjetivo(elementos: Elemento[], proporcion: number): number {
  const g = SEPARACION_INVENTARIO;
  const area = elementos.reduce((s, e) => s + (e.ancho + g) * (e.alto + g), 0);
  const masAncho = elementos.reduce((m, e) => Math.max(m, e.ancho), 0);
  return Math.max(masAncho, Math.sqrt(area) * proporcion);
}

const sinLado = (clave: string) => clave.replace(/[-:.](l|r|medio)$/, '');

/**
 * Desplazamiento de inventario para cada pieza visible. Los bloques derechos van a -X, los izquierdos
 * a +X (nunca cambian de lado, D4) y los de la línea media al centro. Cada grupo empieza una fila, y los
 * grupos van de arriba abajo según la altura media de sus piezas en el modelo armado. Todo queda en
 * el plano frontal que pasa por el origen de la explosión.
 * @param cajas caja original de cada pieza; si falta, se usa su centro con TAMANO_MINIMO
 * @param grupo pieza -> grupo que comparte fila (lóbulo)
 */
export function desplazamientosInventario(
  centros: Record<string, Vec3>,
  cajas: Record<string, Caja>,
  visibles: string[],
  bloque: (pieza: string) => string,
  grupo: (pieza: string) => string,
  lado: (pieza: string) => Lado = () => 'medio',
): Record<string, Vec3> {
  const res: Record<string, Vec3> = {};
  const conCentro = visibles.filter((p) => centros[p]).sort();
  const porBloque = new Map<string, { min: Vec3; max: Vec3; grupo: string; lado: Lado }>();
  const alturas = new Map<string, number[]>();
  for (const p of conCentro) {
    const c = centros[p]!;
    const caja = cajas[p] ?? [c, c];
    const k = bloque(p);
    const b = porBloque.get(k);
    if (b) {
      b.min = [Math.min(b.min[0], caja[0][0]), Math.min(b.min[1], caja[0][1]), Math.min(b.min[2], caja[0][2])];
      b.max = [Math.max(b.max[0], caja[1][0]), Math.max(b.max[1], caja[1][1]), Math.max(b.max[2], caja[1][2])];
    } else {
      porBloque.set(k, { min: caja[0], max: caja[1], grupo: grupo(p), lado: lado(p) });
    }
    const gr = grupo(p);
    alturas.set(gr, [...(alturas.get(gr) ?? []), c[1]]);
  }
  if (porBloque.size < 2) return res;

  const alturaGrupo = new Map([...alturas].map(([g, ys]) => [g, ys.reduce((s, y) => s + y, 0) / ys.length]));
  const regiones: Record<Lado, Elemento[]> = { l: [], r: [], medio: [] };
  for (const [clave, b] of porBloque) {
    regiones[b.lado].push({
      clave,
      orden: sinLado(clave),
      grupo: b.grupo,
      centro: escalar(sumar(b.min, b.max), 0.5),
      ancho: Math.max(TAMANO_MINIMO, b.max[0] - b.min[0]),
      alto: Math.max(TAMANO_MINIMO, b.max[1] - b.min[1]),
    });
  }
  // Grupos de arriba abajo; dentro del grupo, del más alto al más bajo (repisas parejas) y por nombre.
  const comparar = (a: Elemento, b: Elemento) =>
    alturaGrupo.get(b.grupo)! - alturaGrupo.get(a.grupo)! ||
    (a.grupo < b.grupo ? -1 : a.grupo > b.grupo ? 1 : 0) ||
    b.alto - a.alto ||
    (a.orden < b.orden ? -1 : a.orden > b.orden ? 1 : 0);
  for (const r of Object.values(regiones)) r.sort(comparar);

  // Los dos lados comparten un solo acomodo, con el tamaño mayor de cada par: así quedan en espejo
  // aunque una pieza y su par no midan lo mismo (el vago derecho no es el reflejo del izquierdo).
  const pares = new Map<string, Elemento>();
  for (const e of [...regiones.l, ...regiones.r]) {
    const par = pares.get(e.orden);
    if (par) pares.set(e.orden, { ...par, ancho: Math.max(par.ancho, e.ancho), alto: Math.max(par.alto, e.alto) });
    else pares.set(e.orden, { ...e, clave: e.orden });
  }
  const listaPares = [...pares.values()].sort(comparar);
  const lados = acomodar(listaPares, anchoObjetivo(listaPares, PROPORCION_LADO));
  const medio = acomodar(regiones.medio, anchoObjetivo(regiones.medio, PROPORCION_MEDIO));

  const origen = origenExplosion(promedio(conCentro.map((p) => centros[p]!)));
  const g = SEPARACION_INVENTARIO;
  const borde = medio.pos.size ? medio.ancho / 2 + g : g / 2;
  const arriba = origen[1] + Math.max(medio.alto, lados.alto) / 2;
  const destino = new Map<string, Vec3>();
  for (const [clave, [x, y]] of medio.pos) destino.set(clave, [origen[0] - medio.ancho / 2 + x, arriba - y, origen[2]]);
  for (const [signo, elementos] of [[1, regiones.l], [-1, regiones.r]] as const) {
    for (const e of elementos) {
      const [x, y] = lados.pos.get(e.orden)!;
      destino.set(e.clave, [origen[0] + signo * (borde + x), arriba - y, origen[2]]);
    }
  }

  const centroDe = new Map(Object.values(regiones).flat().map((e) => [e.clave, e.centro]));
  for (const p of conCentro) {
    const k = bloque(p);
    res[p] = restar(destino.get(k)!, centroDe.get(k)!);
  }
  return res;
}

/** Curva suave de 0 a 1 (sin saltos de velocidad al empezar ni al llegar). */
export const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Desplazamiento del deslizador de explosión (0 a 1). Hasta INICIO_INVENTARIO es la explosión radial,
 * que llega ahí a su factor 1; después cada bloque viaja de su posición radial a su lugar en el inventario.
 */
export function desplazamientosDeslizador(
  centros: Record<string, Vec3>,
  cajas: Record<string, Caja>,
  visibles: string[],
  bloque: (pieza: string) => string,
  grupo: (pieza: string) => string,
  factor: number,
  lado: (pieza: string) => Lado = () => 'medio',
): Record<string, Vec3> {
  const f = Math.min(1, Math.max(0, factor));
  if (f <= INICIO_INVENTARIO) return desplazamientosExplosion(centros, visibles, bloque, f / INICIO_INVENTARIO, lado);
  const radial = desplazamientosExplosion(centros, visibles, bloque, 1, lado);
  const inventario = desplazamientosInventario(centros, cajas, visibles, bloque, grupo, lado);
  const t = suave((f - INICIO_INVENTARIO) / (1 - INICIO_INVENTARIO));
  if (t >= 1) return Object.keys(inventario).length ? inventario : radial;
  const res: Record<string, Vec3> = {};
  for (const [p, r] of Object.entries(radial)) {
    const i = inventario[p];
    res[p] = i ? sumar(r, escalar(restar(i, r), t)) : r;
  }
  return res;
}
