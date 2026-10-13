// Revisión docente (F24): las dudas abiertas están en la web y el orden de "Qué revisar" pone primero
// lo que más necesita el criterio del docente.
import { describe, expect, it } from 'vitest';
import { dudas, estructuras, marcadores } from '../src/data/atlas';
import { avanceDeFicha, avanceGlobal, camposDeFicha, entradasBajo, ordenDeRevision } from '../src/lib/prioridad';
import { claveRespuesta } from '../src/lib/revision';
import type { RutaTrazada } from '../src/lib/rutas';

const conFicha = Object.keys(estructuras).filter((id) => estructuras[id]!.ficha);
const sinSinonimosEs = Object.keys(estructuras).find(
  (id) => estructuras[id]!.ficha && estructuras[id]!.sinonimos.es.length === 0 && estructuras[id]!.sinonimos.en.length > 0,
)!;
const k = (estructura: string, campo: string, idioma?: 'es' | 'en') => claveRespuesta({ estructura, campo, idioma });
const ruta = (lado: RutaTrazada['lado'], entrada: string) => ({ lado, entrada });
const todas = (id: string, idioma: 'es' | 'en' = 'es', rutas: { lado: RutaTrazada['lado']; entrada: string }[] = []) =>
  new Set(camposDeFicha(id, idioma, rutas));

describe('dudas abiertas', () => {
  it('cada duda apunta a una estructura con ficha y viene en los dos idiomas', () => {
    expect(Object.keys(dudas).length).toBeGreaterThan(20);
    for (const [id, l] of Object.entries(dudas)) {
      expect(estructuras[id]?.ficha, id).toBeTruthy();
      for (const d of l) {
        expect(d.texto.es.length, d.id).toBeGreaterThan(20);
        expect(d.texto.en.length, d.id).toBeGreaterThan(20);
        expect(`${d.texto.es}${d.texto.en}`).not.toContain('—');
      }
    }
  });
});

describe('qué revisar', () => {
  it('cubre todas las fichas una sola vez, con las dudas primero y el vago después', () => {
    const orden = ordenDeRevision(new Set(), 'es', [ruta('derecho', 'm-recurrent-laryngeal-nerve')]);
    expect(orden.map((s) => s.seccion)).toEqual(['dudas', 'vago', 'grupos', 'resto']);
    const todos = orden.flatMap((s) => s.ids);
    expect(new Set(todos).size).toBe(todos.length);
    expect([...todos].sort()).toEqual([...conFicha].sort());
    expect(orden[0]!.ids).toContain('gracile-lobule');
    const vago = orden[1]!.ids;
    expect(vago[0]).toBe('m-recurrent-laryngeal-nerve');
    expect(vago).toContain('vagus-nerve-x');
    for (const m of marcadores.filter((x) => x.padre === 'g-vagus-nerve-x' && estructuras[x.id]?.ficha && !dudas[x.id])) {
      expect(vago, m.id).toContain(m.id);
    }
    expect(orden[2]!.ids).toContain('hippocampus');
  });

  it('con una respuesta la ficha sigue en su sección y queda primera de ella', () => {
    const base = ordenDeRevision(new Set(), 'es');
    const grupo = base.find((s) => s.seccion === 'grupos')!.ids;
    const elegida = grupo[grupo.length - 1]!;
    const orden = ordenDeRevision(new Set([k(elegida, 'nombre', 'es')]), 'es');
    const sec = orden.find((s) => s.seccion === 'grupos')!;
    expect(sec.ids[0]).toBe(elegida);
    expect(sec.ids.length).toBe(grupo.length);
    expect(orden.flatMap((s) => s.ids).length).toBe(conFicha.length);
  });

  it('una ficha empezada sube al tope de dudas y las empezadas conservan su orden previo', () => {
    const base = ordenDeRevision(new Set(), 'es')[0]!.ids;
    expect(base.length).toBeGreaterThan(4);
    const [a, b, c] = [base[2]!, base[4]!, base[3]!];
    const orden = ordenDeRevision(new Set([k(a, 'nombre', 'es'), k(b, 'latin'), k(c, 'nombre', 'en')]), 'es')[0]!.ids;
    expect(orden.slice(0, 3)).toEqual([a, c, b]);
    const resto = base.filter((id) => ![a, b, c].includes(id));
    expect(orden.slice(3)).toEqual(resto);
  });

  it('una ficha con todos sus campos respondidos sale de la lista; casi completa sigue', () => {
    const completa = todas('hippocampus');
    const todos = ordenDeRevision(completa, 'es').flatMap((s) => s.ids);
    expect(todos).not.toContain('hippocampus');
    expect(todos.length).toBe(conFicha.length - 1);
    const casi = new Set(completa);
    casi.delete(k('hippocampus', 'ubicacion', 'es'));
    const sigue = ordenDeRevision(casi, 'es');
    expect(sigue.flatMap((s) => s.ids)).toContain('hippocampus');
    expect(sigue.find((s) => s.ids.includes('hippocampus'))!.ids[0]).toBe('hippocampus');
  });

  it('completa en español pero no en inglés: en inglés sigue en la lista', () => {
    const resp = todas('hippocampus', 'es');
    expect(ordenDeRevision(resp, 'es').flatMap((s) => s.ids)).not.toContain('hippocampus');
    expect(ordenDeRevision(resp, 'en').flatMap((s) => s.ids)).toContain('hippocampus');
  });

  it('las rutas trazadas suman campos a la ficha del vago: sin responderlas, sigue', () => {
    const rutas = [ruta('derecho', 'm-recurrent-laryngeal-nerve'), ruta('izquierdo', 'm-recurrent-laryngeal-nerve')];
    const resp = todas('m-recurrent-laryngeal-nerve', 'es');
    expect(ordenDeRevision(resp, 'es', rutas).flatMap((s) => s.ids)).toContain('m-recurrent-laryngeal-nerve');
    expect(ordenDeRevision(todas('m-recurrent-laryngeal-nerve', 'es', rutas), 'es', rutas).flatMap((s) => s.ids)).not.toContain(
      'm-recurrent-laryngeal-nerve',
    );
  });

  it('entradasBajo recoge grupos, estructuras y marcadores de una rama del árbol', () => {
    const limbico = entradasBajo('g-limbic-lobe');
    expect(limbico).toContain('g-limbic-lobe');
    expect(limbico).toContain('hippocampus');
  });
});

describe('campos y avance de una ficha', () => {
  it('gracile-lobule en español: 15 campos, en el orden de la ficha y sin repetir', () => {
    const f = estructuras['gracile-lobule']!.ficha!;
    const campos = camposDeFicha('gracile-lobule', 'es');
    expect(campos.length).toBe(15);
    expect(new Set(campos).size).toBe(15);
    expect(campos).toEqual([
      k('gracile-lobule', 'duda.0'),
      k('gracile-lobule', 'nombre', 'es'),
      k('gracile-lobule', 'nombre', 'en'),
      k('gracile-lobule', 'latin'),
      k('gracile-lobule', 'pieza'),
      k('gracile-lobule', 'que_es', 'es'),
      k('gracile-lobule', 'para_que_sirve', 'es'),
      k('gracile-lobule', 'ubicacion', 'es'),
      k('gracile-lobule', 'relaciones'),
      ...f.relevancia.map((_, i) => k('gracile-lobule', `relevancia.${i}`, 'es')),
      ...f.fuentes.map((_, i) => k('gracile-lobule', `fuente.${i}`)),
    ]);
  });

  it('en inglés cambian solo los campos con idioma; no entran posición ni trazos', () => {
    const es = camposDeFicha('gracile-lobule', 'es');
    const en = camposDeFicha('gracile-lobule', 'en');
    expect(en.length).toBe(es.length);
    expect(en).toContain(k('gracile-lobule', 'que_es', 'en'));
    expect(en).not.toContain(k('gracile-lobule', 'que_es', 'es'));
    expect(en).toContain(k('gracile-lobule', 'nombre', 'es'));
    for (const clave of [...es, ...en]) {
      expect(clave).not.toMatch(/\|posicion\||\|trazo:/);
    }
  });

  it('sinónimos de un solo idioma dan un solo campo, con ese idioma', () => {
    const campos = camposDeFicha(sinSinonimosEs, 'es');
    expect(campos).toContain(k(sinSinonimosEs, 'sinonimos', 'en'));
    expect(campos).not.toContain(k(sinSinonimosEs, 'sinonimos', 'es'));
    expect(campos.filter((c) => c.includes('|sinonimos|')).length).toBe(1);
  });

  it('una entrada sin piezas no tiene campo pieza; una sin dudas no tiene campos duda', () => {
    const sinPiezas = camposDeFicha('m-recurrent-laryngeal-nerve', 'es');
    expect(sinPiezas.some((c) => c.includes('|pieza|'))).toBe(false);
    expect(sinPiezas.length).toBe(15);
    const sinDudas = camposDeFicha('hippocampus', 'es');
    expect(sinDudas.some((c) => c.includes('|duda.'))).toBe(false);
    expect(sinDudas.length).toBe(13);
  });

  it('sin relevancia no hay campos relevancia', () => {
    expect(estructuras['anterior-cochlear-nucleus']!.ficha!.relevancia.length).toBe(0);
    expect(camposDeFicha('anterior-cochlear-nucleus', 'es').some((c) => c.includes('|relevancia.'))).toBe(false);
  });

  it('cada ruta de la entrada suma su campo; las de otra entrada y las repetidas no', () => {
    const id = 'm-recurrent-laryngeal-nerve';
    const base = camposDeFicha(id, 'es');
    const rutas = [ruta('derecho', id), ruta('izquierdo', id), ruta('izquierdo', id), ruta('derecho', 'hippocampus')];
    const con = camposDeFicha(id, 'es', rutas);
    expect(con.length).toBe(base.length + 2);
    expect(new Set(con).size).toBe(con.length);
    expect(con).toContain(k(id, 'trazado_derecho'));
    expect(con).toContain(k(id, 'trazado_izquierdo'));
    expect(camposDeFicha('hippocampus', 'es', rutas)).toContain(k('hippocampus', 'trazado_derecho'));
  });

  it('una entrada sin ficha no tiene campos', () => {
    expect(camposDeFicha('no-existe', 'es')).toEqual([]);
    expect(avanceDeFicha('no-existe', new Set(), 'es')).toEqual({ hechos: 0, total: 0 });
  });

  it('avanceDeFicha cuenta 0, 1 y todas las respuestas; las claves ajenas no cuentan', () => {
    const id = 'hippocampus';
    const total = camposDeFicha(id, 'es').length;
    expect(avanceDeFicha(id, new Set(), 'es')).toEqual({ hechos: 0, total });
    expect(avanceDeFicha(id, new Set([k(id, 'nombre', 'es')]), 'es')).toEqual({ hechos: 1, total });
    expect(avanceDeFicha(id, todas(id), 'es')).toEqual({ hechos: total, total });
    const ajenas = new Set([
      k(id, 'que_es', 'en'),
      k(id, 'posicion'),
      k(id, 'trazo:x'),
      k(id, 'campo_inventado', 'es'),
      k('gracile-lobule', 'nombre', 'es'),
    ]);
    expect(avanceDeFicha(id, ajenas, 'es').hechos).toBe(0);
  });
});

describe('avance global', () => {
  it('cuenta completas sobre todas las entradas con ficha, por idioma', () => {
    expect(avanceGlobal(new Set(), 'es')).toEqual({ completas: 0, total: conFicha.length });
    const resp = todas('hippocampus', 'es');
    expect(avanceGlobal(resp, 'es')).toEqual({ completas: 1, total: conFicha.length });
    expect(avanceGlobal(resp, 'en').completas).toBe(0);
    const casi = new Set(resp);
    casi.delete(k('hippocampus', 'latin'));
    expect(avanceGlobal(casi, 'es').completas).toBe(0);
  });
});
