// Las cuatro asimetrías del vago (ADR 0009, SPEC F25). Si alguna falla, la geometría trazada no se
// publica. Trabaja sobre lo que mide pipeline/auditar-vago.py (anclajes y trazos escaneados) y lo que
// calcula pipeline/generar-ramas-vago.py (rutas trazadas). Coordenadas glTF: Y arriba, +X izquierda.
// El eje anterior no se supone: sale de los datos (la tráquea está por delante del esófago).
// Las asimetrías 3 y 4 miden el tronco publicado (ADR 0010): el escaneado fuera de la banda que
// reemplaza cada ruta torácica, más lo trazado. Lo que se mide es lo que el estudiante ve. Con el Plan B
// (ningún tramo trazado en el lanzamiento) las bandas son `huecos` y no hay nada que medir en ellos.

export type P = [number, number, number];

export type Lado = 'izquierdo' | 'derecho';

/** Tramo del tronco escaneado que reemplaza una ruta torácica o queda como hueco; `y_min` nulo = hasta el final. */
export interface Banda {
  lado: Lado;
  y_max: number;
  y_min: number | null;
}

export interface Ancla {
  tipo: 'CURVE' | 'MESH';
  caja: [P, P];
  puntos?: P[];
  radio?: number;
}

export interface Anclajes {
  anclas: Record<string, Ancla>;
  trazos: Record<string, { puntos: P[] }>;
}

export interface Rutas {
  rutas: Record<string, { lado: Lado; puntos: P[]; reemplaza?: Banda }>;
  /** Tramos del tronco escaneado que no se publican y tampoco se trazan (Plan B del ADR 0010). */
  huecos?: Banda[];
}

/** 0,1 mm, igual que la tolerancia de check:modelo. */
export const TOLERANCIA_BANDA = 0.0001;

const TORACICA: Record<Lado, string> = { derecho: 'vago_toracico_derecho', izquierdo: 'vago_toracico_izquierdo' };

export interface Resultado {
  asimetria: 1 | 2 | 3 | 4;
  ok: boolean;
  detalle: string;
}

const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`;
const centro = (c: [P, P]): P => [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2, (c[0][2] + c[1][2]) / 2];
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const distXZ = (a: P, b: P) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const masBajo = (pts: P[]) => pts.reduce((a, b) => (b[1] < a[1] ? b : a));
const masCercano = (pts: P[], q: P) => pts.reduce((a, b) => (dist(b, q) < dist(a, q) ? b : a));

function ancla(d: Anclajes, nombre: string): Ancla {
  const a = d.anclas[nombre];
  if (!a) throw new Error(`Falta el anclaje "${nombre}": sin él la asimetría no se puede comprobar (corre pipeline/auditar-vago.py)`);
  return a;
}

function lineaCentral(d: Anclajes, nombre: string): P[] {
  const a = ancla(d, nombre);
  if (!a.puntos?.length) throw new Error(`El anclaje "${nombre}" no trae línea central (debería ser una curva)`);
  return a.puntos;
}

/** +1 si anterior es +Z. Sale de los datos: la tráquea está por delante del esófago. */
export function signoAnterior(d: Anclajes): 1 | -1 {
  return centro(ancla(d, 'Trachea').caja)[2] > centro(ancla(d, 'Oesophagus').caja)[2] ? 1 : -1;
}

/** El tronco escaneado de un lado: el trazo más largo. */
export function tronco(d: Anclajes, lado: Lado): P[] {
  const sufijo = lado === 'izquierdo' ? '.l#' : '.r#';
  const largo = (pts: P[]) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]!), 0);
  const candidatos = Object.entries(d.trazos)
    .filter(([n]) => n.includes(sufijo) && !n.includes('#toque'))
    .map(([, t]) => t.puntos);
  if (!candidatos.length) throw new Error(`No hay trazos del vago ${lado}`);
  return candidatos.reduce((a, b) => (largo(b) > largo(a) ? b : a));
}

/** Punto de una polilínea a la altura y (el primero desde arriba); null si no llega. */
export function aAltura(pts: P[], y: number): P | null {
  if (pts.length < 2) return null;
  const orden = pts[0]![1] >= pts.at(-1)![1] ? pts : [...pts].reverse();
  for (let i = 0; i + 1 < orden.length; i++) {
    const a = orden[i]!;
    const b = orden[i + 1]!;
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
      const t = (a[1] - y) / (a[1] - b[1]);
      return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
    }
  }
  return null;
}

/** De arriba abajo, la misma regla que usa aAltura. */
function arribaPrimero(pts: P[]): P[] {
  return pts.length < 2 || pts[0]![1] >= pts.at(-1)![1] ? pts : [...pts].reverse();
}

/** Las bandas del tronco escaneado que no se publican: primero los `huecos` y después las de las rutas con `reemplaza`, en el orden de las rutas. */
export function bandas(r: Rutas): Banda[] {
  const res: Banda[] = (Array.isArray(r.huecos) ? r.huecos : []).map((h) => ({ lado: h.lado, y_max: h.y_max, y_min: h.y_min }));
  for (const ruta of Object.values(r.rutas)) {
    if (ruta.reemplaza) res.push({ lado: ruta.reemplaza.lado, y_max: ruta.reemplaza.y_max, y_min: ruta.reemplaza.y_min });
  }
  return res;
}

/**
 * Recorta el tronco escaneado en la banda: lo de arriba (y >= y_max) y lo de abajo (y <= y_min), con un
 * punto de borde exacto donde un segmento cruza cada borde. No mueve ningún punto conservado.
 */
export function recortarBanda(pts: P[], b: Banda): { arriba: P[]; abajo: P[] } {
  const orden = arribaPrimero(pts);
  const arriba: P[] = [];
  const abajo: P[] = [];
  for (let i = 0; i < orden.length; i++) {
    const p = orden[i]!;
    if (p[1] >= b.y_max) arriba.push(p);
    else if (b.y_min !== null && p[1] <= b.y_min) abajo.push(p);
    const q = orden[i + 1];
    if (!q) continue;
    const bordes = b.y_min === null ? [b.y_max] : p[1] >= q[1] ? [b.y_max, b.y_min] : [b.y_min, b.y_max];
    for (const c of bordes) {
      if ((p[1] - c) * (q[1] - c) < 0) {
        const t = (p[1] - c) / (p[1] - q[1]);
        const borde: P = [p[0] + (q[0] - p[0]) * t, c, p[2] + (q[2] - p[2]) * t];
        (c === b.y_max ? arriba : abajo).push(borde);
      }
    }
  }
  return { arriba, abajo };
}

function partes(d: Anclajes, r: Rutas, lado: Lado): { banda: Banda; arriba: P[]; ruta: P[]; distal: P[]; abajo: P[] } {
  const id = TORACICA[lado];
  const tor = r.rutas[id];
  if (!tor) throw new Error(`Falta la ruta ${id}: sin ella no se sabe qué se publica del vago ${lado}`);
  if (!tor.reemplaza) throw new Error(`La ruta ${id} no trae "reemplaza": sin la banda no se sabe qué escaneado se publica (corre pipeline/generar-ramas-vago.py)`);
  const { arriba, abajo } = recortarBanda(tronco(d, lado), tor.reemplaza);
  const distal = lado === 'izquierdo' ? arribaPrimero(r.rutas['vago_izquierdo_distal']?.puntos ?? []) : [];
  return { banda: tor.reemplaza, arriba, ruta: arribaPrimero(tor.puntos), distal, abajo };
}

/** Lo que ve el estudiante de un vago, de arriba abajo por tramos: escaneado de arriba, ruta torácica, distal (izquierdo), escaneado de abajo. */
export function troncoPublicado(d: Anclajes, r: Rutas, lado: Lado): P[] {
  const p = partes(d, r, lado);
  return [...p.arriba, ...p.ruta, ...p.distal, ...p.abajo];
}

/** Los puntos que quedan dentro de la banda, con tolerancia en el borde. */
export function puntosEnBanda(pts: P[], b: Banda, tolerancia = TOLERANCIA_BANDA): P[] {
  return pts.filter((p) => p[1] < b.y_max - tolerancia && (b.y_min === null || p[1] > b.y_min + tolerancia));
}

/** R3.3: si queda escaneado dentro del tramo reemplazado, falla nombrando el lado y la altura (m, coordenadas glTF). */
export function comprobarBanda(puntos: P[], banda: Banda, lado: Lado, tolerancia = TOLERANCIA_BANDA): void {
  const dentro = puntosEnBanda(puntos, banda, tolerancia);
  if (!dentro.length) return;
  const hasta = banda.y_min === null ? 'abajo' : `${banda.y_min.toFixed(4)} m`;
  throw new Error(
    `Queda escaneado del vago ${lado} dentro del tramo reemplazado: ${dentro.length} punto(s), el primero a la altura y = ${dentro[0]![1].toFixed(4)} m (banda de ${banda.y_max.toFixed(4)} m a ${hasta})`,
  );
}

/** El punto más bajo de la ruta queda por debajo del vaso, cerca de él en planta, y la ruta vuelve a subir. */
function rodeaPorDebajo(ruta: P[], vaso: P[], radio: number, que: string): { ok: boolean; detalle: string; bajo: P } {
  const bajo = masBajo(ruta);
  const cercaVaso = vaso.reduce((a, b) => (distXZ(b, bajo) < distXZ(a, bajo) ? b : a));
  const debajo = bajo[1] < cercaVaso[1] - radio;
  const enPlanta = distXZ(bajo, cercaVaso) < radio + 0.01;
  const sube = ruta.at(-1)![1] - bajo[1] > 0.03;
  const ok = debajo && enPlanta && sube;
  return {
    ok,
    bajo,
    detalle: ok
      ? `pasa ${mm(cercaVaso[1] - bajo[1])} por debajo de ${que} y sube ${mm(ruta.at(-1)![1] - bajo[1])}`
      : `no rodea ${que} por debajo: ${!debajo ? `su punto más bajo está ${mm(bajo[1] - cercaVaso[1])} por encima del eje` : ''}${!enPlanta ? ` queda a ${mm(distXZ(bajo, cercaVaso))} en planta` : ''}${!sube ? ' no vuelve a subir' : ''}`.trim(),
  };
}

/** 1. El laríngeo recurrente derecho pasa por debajo de la arteria subclavia derecha. */
export function asimetria1(d: Anclajes, r: Rutas): Resultado {
  const ruta = r.rutas['laringeo_recurrente_derecho'];
  if (!ruta) throw new Error('Falta la ruta laringeo_recurrente_derecho');
  const a = ancla(d, 'Right subclavian artery');
  const res = rodeaPorDebajo(ruta.puntos, lineaCentral(d, 'Right subclavian artery'), a.radio ?? 0, 'la subclavia derecha');
  const derecha = res.bajo[0] < 0;
  return { asimetria: 1, ok: res.ok && derecha, detalle: derecha ? res.detalle : 'el asa queda en el lado izquierdo' };
}

/** 2. El laríngeo recurrente izquierdo rodea el arco aórtico junto al ligamento arterioso. */
export function asimetria2(d: Anclajes, r: Rutas): Resultado {
  const ruta = r.rutas['laringeo_recurrente_izquierdo'];
  if (!ruta) throw new Error('Falta la ruta laringeo_recurrente_izquierdo');
  const arco = ancla(d, 'Aortic arch');
  const res = rodeaPorDebajo(ruta.puntos, lineaCentral(d, 'Aortic arch'), arco.radio ?? 0, 'el arco aórtico');
  // Z-Anatomy no trae el ligamento: su ganglio marca el mismo sitio (ver pipeline/auditar-vago.py).
  const ligamento = centro(ancla(d, 'Node of ligamentum arteriosum').caja);
  const junto = dist(res.bajo, ligamento) < (arco.radio ?? 0) + 0.025;
  const izquierda = res.bajo[0] > 0;
  const ok = res.ok && junto && izquierda;
  return {
    asimetria: 2,
    ok,
    detalle: ok ? `${res.detalle}, a ${mm(dist(res.bajo, ligamento))} del ganglio del ligamento arterioso` : !res.ok ? res.detalle : !junto ? `el asa queda a ${mm(dist(res.bajo, ligamento))} del ganglio del ligamento arterioso` : 'el asa queda en el lado derecho',
  };
}

/** 3. El vago izquierdo pasa por delante del arco aórtico y por detrás del bronquio principal izquierdo. Mide el tronco publicado; sin rutas, el escaneado. */
export function asimetria3(d: Anclajes, r: Rutas | null): Resultado {
  const ant = signoAnterior(d);
  const arco = lineaCentral(d, 'Aortic arch');
  const cima = arco.reduce((a, b) => (b[1] > a[1] ? b : a));
  const izquierdo = r ? troncoPublicado(d, r, 'izquierdo') : tronco(d, 'izquierdo');
  const v = aAltura(izquierdo, cima[1]);
  if (!v) return { asimetria: 3, ok: false, detalle: 'el vago izquierdo no llega a la altura del arco aórtico' };
  const delante = (v[2] - cima[2]) * ant > 0;
  let detalle = delante ? `cruza el arco ${mm((v[2] - cima[2]) * ant)} por delante` : `cruza el arco ${mm((cima[2] - v[2]) * ant)} por detrás`;
  let ok = delante;
  const bronquio = lineaCentral(d, 'Left main bronchus');
  const b = centro(ancla(d, 'Left main bronchus').caja);
  const cercano = masCercano(izquierdo, b);
  const enBronquio = masCercano(bronquio, cercano);
  const detras = (cercano[2] - enBronquio[2]) * ant < 0;
  ok &&= detras;
  detalle += detras ? '; pasa por detrás del bronquio principal izquierdo' : '; NO pasa por detrás del bronquio principal izquierdo';
  return { asimetria: 3, ok, detalle };
}

/** 4. El vago derecho pasa por detrás del bronquio principal derecho y del esófago. Mide el tronco publicado; sin rutas, el escaneado. */
export function asimetria4(d: Anclajes, r: Rutas | null): Resultado {
  const ant = signoAnterior(d);
  const derecho = r ? troncoPublicado(d, r, 'derecho') : tronco(d, 'derecho');
  const bronquio = lineaCentral(d, 'Right main bronchus');
  const b = centro(ancla(d, 'Right main bronchus').caja);
  const v1 = aAltura(derecho, b[1]);
  const esofago = lineaCentral(d, 'Oesophagus');
  const yEsofago = masBajo(esofago)[1] + 0.05;
  const v2 = aAltura(derecho, yEsofago);
  const e = aAltura(esofago, yEsofago);
  if (!v1 || !v2 || !e) return { asimetria: 4, ok: false, detalle: 'el vago derecho no llega a la altura del bronquio o del esófago' };
  const enBronquio = masCercano(bronquio, v1);
  const trasBronquio = (v1[2] - enBronquio[2]) * ant < 0;
  const trasEsofago = (v2[2] - e[2]) * ant < 0;
  return {
    asimetria: 4,
    ok: trasBronquio && trasEsofago,
    detalle: `${trasBronquio ? 'por detrás' : 'NO por detrás'} del bronquio principal derecho; ${trasEsofago ? 'por detrás' : 'NO por detrás'} del esófago 5 cm sobre su final`,
  };
}

/**
 * Todas las que se pueden comprobar: sin rutas trazadas, solo las que dependen de lo escaneado. Con
 * rutas, exige `reemplaza` en cada ruta torácica y que no quede escaneado dentro de la banda.
 */
export function comprobar(d: Anclajes, r: Rutas | null): Resultado[] {
  if (!r) return [asimetria4(d, null)];
  for (const lado of ['derecho', 'izquierdo'] as const) {
    const p = partes(d, r, lado);
    comprobarBanda([...p.arriba, ...p.abajo], p.banda, lado);
  }
  return [asimetria1(d, r), asimetria2(d, r), asimetria3(d, r), asimetria4(d, r)];
}
