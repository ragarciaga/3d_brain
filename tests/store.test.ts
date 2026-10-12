import { beforeEach, describe, expect, it } from 'vitest';
import { piezasDeEntrada } from '../src/data/atlas';
import { estadoAislar, estadoSeparar } from '../src/lib/alternar';
import { desplazamientoSeparar, promedio, type Vec3 } from '../src/lib/explosion';
import { INICIO_INVENTARIO } from '../src/lib/inventario';
import { bloqueDe, fueraDeSitio, hayFiltros, ladoDe, objetivo, piezasDeEncuadre, piezasVisibles, useAtlas } from '../src/store/useAtlas';

const centros = Object.fromEntries(
  ['hippocampus-l', 'hippocampus-r', 'thalamus-l', 'thalamus-r', 'precentral-gyrus-l', 'postcentral-gyrus-l'].map((p, i) => [
    p,
    [(i % 2 ? -1 : 1) * 0.02 * (i + 1), 1.6 + i * 0.01, 0.01 * i] as [number, number, number],
  ]),
);

describe('estado del atlas', () => {
  beforeEach(() => {
    useAtlas.setState({
      ocultas: new Set(),
      aislar: null,
      explosion: 0,
      nivel: 'piezas',
      separadas: {},
      devueltas: new Set(),
      armando: null,
      seleccion: { entrada: null, pieza: null, malla: null },
    });
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

  describe('armar pieza por pieza', () => {
    it('sin explosión entra igual, en modo tocar y con total vacío; al mover la explosión el total se recalcula', () => {
      useAtlas.getState().armarPiezaPorPieza();
      expect(useAtlas.getState().armando).toEqual({ modo: 'tocar', total: [] });
      useAtlas.getState().setExplosion(0.5);
      expect(useAtlas.getState().armando!.modo).toBe('tocar');
      expect(useAtlas.getState().armando!.total.length).toBeGreaterThan(1);
    });

    it('armarPiezaPorPieza("reto") entra en modo reto', () => {
      useAtlas.getState().setExplosion(0.5);
      useAtlas.getState().armarPiezaPorPieza('reto');
      expect(useAtlas.getState().armando!.modo).toBe('reto');
      expect(useAtlas.getState().armando!.total.length).toBeGreaterThan(1);
    });

    it('mover la explosión durante el reto conserva el modo reto', () => {
      useAtlas.getState().armarPiezaPorPieza('reto');
      useAtlas.getState().setExplosion(0.7);
      expect(useAtlas.getState().armando!.modo).toBe('reto');
      expect(useAtlas.getState().armando!.total.length).toBeGreaterThan(1);
    });

    it('setModoArmado cambia el modo y conserva el total', () => {
      useAtlas.getState().setExplosion(0.5);
      useAtlas.getState().armarPiezaPorPieza();
      const total = useAtlas.getState().armando!.total;
      useAtlas.getState().setModoArmado('reto');
      expect(useAtlas.getState().armando).toEqual({ modo: 'reto', total });
    });

    it('setModoArmado sin modo activo no hace nada', () => {
      useAtlas.getState().setModoArmado('reto');
      expect(useAtlas.getState().armando).toBeNull();
    });

    it('el total no incluye las piezas de referencia, aunque estén separadas', () => {
      useAtlas.getState().setExplosion(0.5);
      useAtlas.setState({ separadas: { stomach: [0.1, 0, 0] } });
      expect(fueraDeSitio(useAtlas.getState(), 'stomach')).toBe(true);
      useAtlas.getState().armarPiezaPorPieza();
      const { total } = useAtlas.getState().armando!;
      expect(total).not.toContain('stomach');
      expect(total.length).toBeGreaterThan(1);
    });

    it('terminarArmado y reensamblarTodo dejan armando en null', () => {
      useAtlas.getState().setExplosion(0.5);
      useAtlas.getState().armarPiezaPorPieza();
      useAtlas.getState().terminarArmado();
      expect(useAtlas.getState().armando).toBeNull();
      useAtlas.getState().armarPiezaPorPieza('reto');
      useAtlas.getState().reensamblarTodo();
      expect(useAtlas.getState().armando).toBeNull();
    });
  });

  it('estadoAislar sigue las acciones reales: true, mixed al sumar otra pieza, false al salir', () => {
    const par = ['thalamus-r', 'thalamus-l'];
    useAtlas.getState().aislarPiezas(par, 'solo');
    expect(estadoAislar(useAtlas.getState().aislar, 'solo', par)).toBe(true);
    useAtlas.getState().aislarPiezas(['hippocampus-l'], 'solo', true);
    expect(estadoAislar(useAtlas.getState().aislar, 'solo', par)).toBe('mixed');
    useAtlas.getState().salirAislar();
    expect(estadoAislar(useAtlas.getState().aislar, 'solo', par)).toBe(false);
  });

  it('estadoSeparar sigue las acciones reales: true, mixed al devolver una, false al devolver ambas', () => {
    const par = ['thalamus-l', 'thalamus-r'];
    useAtlas.getState().separar(par);
    let st = useAtlas.getState();
    expect(estadoSeparar(st.separadas, st.devueltas, par)).toBe(true);
    useAtlas.getState().devolver(['thalamus-l']);
    st = useAtlas.getState();
    expect(estadoSeparar(st.separadas, st.devueltas, par)).toBe('mixed');
    useAtlas.getState().devolver(['thalamus-r']);
    st = useAtlas.getState();
    expect(estadoSeparar(st.separadas, st.devueltas, par)).toBe(false);
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

  it('separar dos piezas bilaterales en "aislar con contexto" manda la izquierda a +X y la derecha a -X', () => {
    // Con el mismo centro en x, solo el lado de cada pieza decide hacia dónde sale.
    useAtlas.getState().setCentros({ ...centros, 'hippocampus-l': [0.01, 1.6, 0], 'hippocampus-r': [0.01, 1.6, 0] });
    useAtlas.getState().aislarPiezas(['hippocampus-l', 'hippocampus-r'], 'contexto');
    useAtlas.getState().separar(['hippocampus-l', 'hippocampus-r']);
    const { separadas } = useAtlas.getState();
    expect(separadas['hippocampus-l']![0]).toBeGreaterThan(0);
    expect(separadas['hippocampus-r']![0]).toBeLessThan(0);
  });

  it('separar una pieza r cuyo centro quedó en x positivo la manda a -X, y una l en x negativo a +X', () => {
    useAtlas.getState().setCentros({ ...centros, 'hippocampus-r': [0.02, 1.6, 0], 'hippocampus-l': [-0.02, 1.6, 0] });
    useAtlas.getState().separar(['hippocampus-r', 'hippocampus-l']);
    const { separadas } = useAtlas.getState();
    expect(separadas['hippocampus-r']![0]).toBeLessThan(0);
    expect(separadas['hippocampus-l']![0]).toBeGreaterThan(0);
  });

  it('el conjunto armado de "separar" incluye los fantasmas de "aislar con contexto"', () => {
    const todos = Object.values(centros);
    const conjunto = promedio(todos);
    useAtlas.getState().aislarPiezas(['thalamus-l'], 'contexto');
    useAtlas.getState().separar(['thalamus-l']);
    const esperado = desplazamientoSeparar(centros['thalamus-l'] as Vec3, conjunto, 'l');
    const real = useAtlas.getState().separadas['thalamus-l']!;
    for (let i = 0; i < 3; i++) expect(real[i]).toBeCloseTo(esperado[i]!, 9);
  });

  it('en explosión, una pieza r con centro en x positivo se aleja hacia -X', () => {
    useAtlas.getState().setCentros({ ...centros, 'hippocampus-r': [0.02, 1.6, 0] });
    useAtlas.getState().setExplosion(1);
    expect(useAtlas.getState().base['hippocampus-r']![0]).toBeLessThanOrEqual(0);
  });

  it('separar omite las piezas sin centro', () => {
    useAtlas.getState().separar(['hippocampus-l', 'amygdaloid-body-l']);
    const { separadas } = useAtlas.getState();
    expect(separadas['hippocampus-l']).toBeDefined();
    expect(separadas['amygdaloid-body-l']).toBeUndefined();
  });

  it('por hemisferios, las piezas de un lado se mueven juntas y cada lado se va al suyo', () => {
    useAtlas.getState().setNivel('hemisferios');
    useAtlas.getState().setExplosion(INICIO_INVENTARIO);
    const { base } = useAtlas.getState();
    expect(base['hippocampus-l']).toEqual(base['precentral-gyrus-l']);
    expect(base['hippocampus-l']![0]).toBeGreaterThan(0);
    expect(base['hippocampus-r']![0]).toBeLessThan(0);
  });

  it('en el inventario (100 %), los bloques se mueven juntos y cada lado queda en el suyo', () => {
    useAtlas.getState().setNivel('hemisferios');
    useAtlas.getState().setExplosion(1);
    const { base } = useAtlas.getState();
    expect(base['hippocampus-l']).toEqual(base['precentral-gyrus-l']);
    expect(centros['hippocampus-l']![0] + base['hippocampus-l']![0]).toBeGreaterThan(0);
    expect(centros['hippocampus-r']![0] + base['hippocampus-r']![0]).toBeLessThan(0);
  });

  it('por lóbulos, los giros del mismo lóbulo y lado se mueven juntos, como dice bloqueDe', () => {
    useAtlas.getState().setCentros({ ...centros, 'superior-frontal-gyrus-l': [0.05, 1.7, 0.09] });
    useAtlas.getState().setNivel('lobulos');
    useAtlas.getState().setExplosion(1);
    const { base } = useAtlas.getState();
    expect(bloqueDe('superior-frontal-gyrus-l', 'lobulos')).toBe(bloqueDe('precentral-gyrus-l', 'lobulos'));
    expect(base['superior-frontal-gyrus-l']).toEqual(base['precentral-gyrus-l']);
    expect(bloqueDe('postcentral-gyrus-l', 'lobulos')).not.toBe(bloqueDe('precentral-gyrus-l', 'lobulos'));
    expect(base['postcentral-gyrus-l']).not.toEqual(base['precentral-gyrus-l']);
  });

  it.each(['hemisferios', 'lobulos', 'piezas'] as const)('reensamblar con explosión y piezas separadas deja todo en cero (nivel %s)', (nivel) => {
    const s = useAtlas.getState();
    s.setNivel(nivel);
    s.setExplosion(0.6);
    s.separar(['thalamus-r', 'hippocampus-l']);
    expect(fueraDeSitio(useAtlas.getState(), 'thalamus-r')).toBe(true);
    useAtlas.getState().reensamblarTodo();
    for (const p of Object.keys(centros)) expect(objetivo(useAtlas.getState(), p)).toEqual([0, 0, 0]);
  });

  it('ladoDe: sin lado cuenta como medio', () => {
    expect(ladoDe('hippocampus-l')).toBe('l');
    expect(ladoDe('hippocampus-r')).toBe('r');
    expect(ladoDe('corpus-callosum')).toBe('medio');
    expect(ladoDe('no-existe')).toBe('medio');
  });
});

describe('piezas para encuadrar la cámara', () => {
  beforeEach(() => {
    useAtlas.setState({ ocultas: new Set(), aislar: null });
  });

  it('sin filtros son las 253 piezas del encéfalo y ningún vago', () => {
    const piezas = piezasDeEncuadre(useAtlas.getState());
    expect(piezas).toHaveLength(253);
    expect(piezas.some((p) => p.startsWith('vagus-nerve'))).toBe(false);
  });

  it('aislando los dos hipocampos con "solo", son esos dos', () => {
    useAtlas.getState().aislarPiezas(['hippocampus-l', 'hippocampus-r'], 'solo');
    expect(piezasDeEncuadre(useAtlas.getState()).sort()).toEqual(['hippocampus-l', 'hippocampus-r']);
  });

  it('con solo el vago aislado, son las dos piezas del vago', () => {
    useAtlas.getState().aislarPiezas(['vagus-nerve-x-l', 'vagus-nerve-x-r'], 'solo');
    expect(piezasDeEncuadre(useAtlas.getState()).sort()).toEqual(['vagus-nerve-x-l', 'vagus-nerve-x-r']);
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
