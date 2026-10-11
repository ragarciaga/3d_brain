import { beforeEach, describe, expect, it } from 'vitest';
import { piezasDeEntrada } from '../src/data/atlas';
import { bloqueDe, fueraDeSitio, hayFiltros, objetivo, piezasVisibles, useAtlas } from '../src/store/useAtlas';

const centros = Object.fromEntries(
  ['hippocampus-l', 'hippocampus-r', 'thalamus-l', 'thalamus-r', 'precentral-gyrus-l', 'postcentral-gyrus-l'].map((p, i) => [
    p,
    [(i % 2 ? -1 : 1) * 0.02 * (i + 1), 1.6 + i * 0.01, 0.01 * i] as [number, number, number],
  ]),
);

describe('estado del atlas', () => {
  beforeEach(() => {
    useAtlas.setState({ ocultas: new Set(), aislar: null, explosion: 0, separadas: {}, devueltas: new Set(), armando: null });
    useAtlas.getState().setCentros(centros);
  });

  it('separar y devolver una pieza deja su desplazamiento exactamente en cero (F7)', () => {
    const s = useAtlas.getState();
    s.separar(['hippocampus-l']);
    expect(fueraDeSitio(useAtlas.getState(), 'hippocampus-l')).toBe(true);
    useAtlas.getState().devolver(['hippocampus-l']);
    expect(objetivo(useAtlas.getState(), 'hippocampus-l')).toEqual([0, 0, 0]);
  });

  it('reensamblar todo vuelve todas las piezas a cero', () => {
    const s = useAtlas.getState();
    s.setExplosion(0.8);
    s.separar(['thalamus-r']);
    expect(Object.keys(useAtlas.getState().base).length).toBeGreaterThan(0);
    useAtlas.getState().reensamblarTodo();
    for (const p of Object.keys(centros)) expect(objetivo(useAtlas.getState(), p)).toEqual([0, 0, 0]);
  });

  it('armar pieza por pieza cuenta las piezas devueltas', () => {
    const s = useAtlas.getState();
    s.setExplosion(0.5);
    s.armarPiezaPorPieza();
    const total = useAtlas.getState().armando!.total;
    expect(total.length).toBeGreaterThan(1);
    useAtlas.getState().devolver([total[0]!]);
    const st = useAtlas.getState();
    expect(st.armando!.total.filter((p) => !fueraDeSitio(st, p))).toEqual([total[0]]);
  });

  it('separar por lóbulos mueve juntos los giros del mismo lóbulo y lado', () => {
    expect(bloqueDe('precentral-gyrus-l', 'lobulos')).toBe(bloqueDe('superior-frontal-gyrus-l', 'lobulos'));
    expect(bloqueDe('precentral-gyrus-l', 'lobulos')).not.toBe(bloqueDe('precentral-gyrus-r', 'lobulos'));
    expect(bloqueDe('hippocampus-l', 'hemisferios')).toBe(bloqueDe('precentral-gyrus-l', 'hemisferios'));
  });

  it('aislar solo deja visibles las piezas aisladas; ocultar un grupo oculta todas sus hijas (F2, F5)', () => {
    const s = useAtlas.getState();
    s.aislarPiezas(piezasDeEntrada('hippocampus'), 'solo');
    expect(piezasVisibles(useAtlas.getState()).sort()).toEqual(['hippocampus-l', 'hippocampus-r']);
    useAtlas.getState().salirAislar();
    useAtlas.getState().alternarVisibles(piezasDeEntrada('g-temporal-lobe'), false);
    const visibles = new Set(piezasVisibles(useAtlas.getState()));
    expect(piezasDeEntrada('g-temporal-lobe').some((p) => visibles.has(p))).toBe(false);
  });
});

describe('salir de la selección y "Mostrar todo"', () => {
  beforeEach(() => {
    useAtlas.setState({
      ocultas: new Set(),
      aislar: null,
      grupoActivo: null,
      seleccion: { entrada: null, pieza: null, malla: null },
    });
  });

  it('deseleccionar limpia la selección y sale del fantasma ("aislar con contexto")', () => {
    const s = useAtlas.getState();
    s.seleccionar({ entrada: 'hippocampus' });
    s.aislarPiezas(piezasDeEntrada('hippocampus'), 'contexto');
    useAtlas.getState().deseleccionar();
    expect(useAtlas.getState().seleccion.entrada).toBeNull();
    expect(useAtlas.getState().aislar).toBeNull();
  });

  it('deseleccionar no toca un aislamiento "solo" que el usuario pidió', () => {
    const s = useAtlas.getState();
    s.seleccionar({ entrada: 'hippocampus' });
    s.aislarPiezas(piezasDeEntrada('hippocampus'), 'solo');
    useAtlas.getState().deseleccionar();
    expect(useAtlas.getState().seleccion.entrada).toBeNull();
    expect(useAtlas.getState().aislar?.modo).toBe('solo');
  });

  it('hayFiltros es verdadero con piezas ocultas, con aislamiento o con un grupo activo, y falso sin nada', () => {
    expect(hayFiltros(useAtlas.getState())).toBe(false);
    useAtlas.getState().alternarVisibles(['hippocampus-l'], false);
    expect(hayFiltros(useAtlas.getState())).toBe(true);
    useAtlas.getState().mostrarTodo();
    useAtlas.getState().aislarPiezas(['hippocampus-l'], 'solo');
    expect(hayFiltros(useAtlas.getState())).toBe(true);
    useAtlas.getState().mostrarTodo();
    useAtlas.setState({ grupoActivo: 'sistema-limbico' });
    expect(hayFiltros(useAtlas.getState())).toBe(true);
  });

  it('mostrarTodo borra piezas ocultas, aislamiento y grupo activo', async () => {
    const { piezasDeGrupo } = await import('../src/data/atlas');
    useAtlas.getState().activarGrupo('sistema-limbico', piezasDeGrupo('sistema-limbico'));
    useAtlas.getState().aislarPiezas(['hippocampus-l'], 'solo');
    useAtlas.getState().mostrarTodo();
    const s = useAtlas.getState();
    expect(s.ocultas.size).toBe(0);
    expect(s.aislar).toBeNull();
    expect(s.grupoActivo).toBeNull();
    expect(hayFiltros(s)).toBe(false);
  });
});

describe('grupos de estudio (F2)', () => {
  it('elegir "Sistema límbico" deja visibles exactamente sus piezas', async () => {
    const { piezasDeGrupo } = await import('../src/data/atlas');
    const piezas = piezasDeGrupo('sistema-limbico');
    expect(piezas.length).toBeGreaterThan(10);
    useAtlas.getState().activarGrupo('sistema-limbico', piezas);
    expect(piezasVisibles(useAtlas.getState()).sort()).toEqual([...piezas].sort());
    useAtlas.getState().activarGrupo(null);
    expect(useAtlas.getState().ocultas.size).toBe(0);
  });
});
