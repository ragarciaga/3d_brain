// Revisión docente (F24): las dudas abiertas están en la web y el orden de "Qué revisar" pone primero
// lo que más necesita el criterio del docente.
import { describe, expect, it } from 'vitest';
import { dudas, estructuras, marcadores } from '../src/data/atlas';
import { entradasBajo, ordenDeRevision } from '../src/lib/prioridad';

const conFicha = Object.keys(estructuras).filter((id) => estructuras[id]!.ficha);

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
    const orden = ordenDeRevision(new Set(), ['m-recurrent-laryngeal-nerve']);
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

  it('lo que ya tiene respuesta sale de la lista', () => {
    const orden = ordenDeRevision(new Set(['gracile-lobule', 'hippocampus']));
    const todos = orden.flatMap((s) => s.ids);
    expect(todos).not.toContain('gracile-lobule');
    expect(todos).not.toContain('hippocampus');
    expect(todos.length).toBe(conFicha.length - 2);
  });

  it('entradasBajo recoge grupos, estructuras y marcadores de una rama del árbol', () => {
    const limbico = entradasBajo('g-limbic-lobe');
    expect(limbico).toContain('g-limbic-lobe');
    expect(limbico).toContain('hippocampus');
  });
});
