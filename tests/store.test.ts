import { beforeEach, describe, expect, it } from 'vitest';
import { esFragmentable, GRUPO_VAGO, piezasBajo, piezasDeEntrada } from '../src/data/atlas';
import { estadoAislar, estadoSeparar } from '../src/lib/alternar';
import { cortesApagados, piezasEncefalo, rangoCerebro } from '../src/lib/cortes';
import type { Caja } from '../src/lib/inventario';
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
      seleccion: { entrada: null, pieza: null, malla: null },
      cortes: cortesApagados(),
      fantasmaCorte: false,
      rellenoApagado: false,
    });
    useAtlas.getState().setCentros(centros);
  });

  it('el vago no se fragmenta: ni la explosión ni Separar lo mueven, y no corre el centro del conjunto (ADR 0009)', () => {
    const vagos = piezasBajo('g-vagus-nerve-x');
    expect(vagos).toEqual(expect.arrayContaining(['vagus-nerve-x-l', 'vagus-nerve-x-r']));
    for (const v of vagos) expect(esFragmentable(v)).toBe(false);
    expect(esFragmentable('thalamus-l')).toBe(true);
    const sinVago = useAtlas.getState();
    sinVago.setExplosion(0.5);
    const baseSinVago = useAtlas.getState().base['thalamus-l'];
    useAtlas.getState().setCentros({ ...centros, 'vagus-nerve-x-l': [0.03, 1.2, 0.02], 'vagus-nerve-x-r': [-0.03, 1.1, 0.02] });
    const st = useAtlas.getState();
    expect(st.base['thalamus-l']).toEqual(baseSinVago);
    for (const v of vagos) expect(objetivo(st, v)).toEqual([0, 0, 0]);
    st.separar(vagos);
    for (const v of vagos) expect(fueraDeSitio(useAtlas.getState(), v)).toBe(false);
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

  it('devolver una pieza con explosión la deja en su sitio y las demás siguen fuera', () => {
    useAtlas.getState().setExplosion(0.5);
    useAtlas.getState().devolver(['thalamus-l']);
    const st = useAtlas.getState();
    expect(fueraDeSitio(st, 'thalamus-l')).toBe(false);
    expect(fueraDeSitio(st, 'thalamus-r')).toBe(true);
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

  it('con menos de 8 bloques no hay inventario: al 100 % sigue la radial y cada lado se va al suyo', () => {
    useAtlas.getState().setNivel('hemisferios');
    useAtlas.getState().setExplosion(1);
    const { base, inventario } = useAtlas.getState();
    expect(inventario).toBe(false);
    expect(base['hippocampus-l']).toEqual(base['precentral-gyrus-l']);
    expect(base['hippocampus-l']![0]).toBeGreaterThan(0);
    expect(base['hippocampus-r']![0]).toBeLessThan(0);
  });

  it('con 8 bloques o más, pasar del 70 % activa el inventario y bajar de nuevo lo apaga', () => {
    const muchos = Object.fromEntries(
      ['amygdaloid-body-l', 'amygdaloid-body-r', 'superior-frontal-gyrus-l', 'superior-frontal-gyrus-r'].map((p, i) => [
        p,
        [(i % 2 ? -1 : 1) * 0.03, 1.62 + i * 0.01, 0.02] as [number, number, number],
      ]),
    );
    useAtlas.getState().setCentros({ ...centros, ...muchos });
    useAtlas.getState().setExplosion(INICIO_INVENTARIO);
    expect(useAtlas.getState().inventario).toBe(false);
    useAtlas.getState().setExplosion(1);
    expect(useAtlas.getState().inventario).toBe(true);
    const { base } = useAtlas.getState();
    expect(centros['hippocampus-l']![0] + base['hippocampus-l']![0]).toBeGreaterThan(0);
    expect(centros['hippocampus-r']![0] + base['hippocampus-r']![0]).toBeLessThan(0);
    useAtlas.getState().setExplosion(0.5);
    expect(useAtlas.getState().inventario).toBe(false);
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

describe('modo revisión: diálogo y carga de respuestas', () => {
  it('setDialogoRevision publica si hay un diálogo abierto', () => {
    useAtlas.getState().setDialogoRevision(true);
    expect(useAtlas.getState().dialogoRevision).toBe(true);
    useAtlas.getState().setDialogoRevision(false);
    expect(useAtlas.getState().dialogoRevision).toBe(false);
  });

  it('cargarRespuestas reemplaza las respuestas y sube el contador en cada carga', () => {
    const antes = useAtlas.getState().cargaRespuestas;
    const resp = { estructura: 'hippocampus', campo: 'que_es', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-11T00:00:00Z' } as const;
    useAtlas.getState().cargarRespuestas({ 'hippocampus|que_es|es': resp });
    expect(useAtlas.getState().respuestas).toEqual({ 'hippocampus|que_es|es': resp });
    expect(useAtlas.getState().cargaRespuestas).toBe(antes + 1);
    useAtlas.getState().cargarRespuestas({});
    expect(useAtlas.getState().respuestas).toEqual({});
    expect(useAtlas.getState().cargaRespuestas).toBe(antes + 2);
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

describe('proponer posición (F24)', () => {
  const M = 'm-periaqueductal-grey';
  const posicion = {
    estructura: M,
    campo: 'posicion',
    veredicto: 'corregir' as const,
    posicion: [0.1, 0.2, 0.3] as [number, number, number],
    version: 'sin-ficha',
    fecha: '2026-10-11T00:00:00Z',
  };
  const otra = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es' as const, veredicto: 'correcto' as const, version: '0.1.0', fecha: '2026-10-11T00:00:00Z' };

  beforeEach(() => {
    useAtlas.setState({ respuestas: {}, piezaPropuesta: {}, ubicando: M });
  });

  it('guarda la respuesta, recuerda la pieza tocada y deja de esperar un toque', () => {
    useAtlas.getState().proponerPosicion(posicion, 'stomach');
    const s = useAtlas.getState();
    expect(s.respuestas[`${M}|posicion|`]).toEqual(posicion);
    expect(s.piezaPropuesta[M]).toBe('stomach');
    expect(s.ubicando).toBeNull();
  });

  it('deshacer borra la respuesta y la pieza, vuelve a esperar un toque y respeta las demás respuestas', () => {
    useAtlas.setState({ respuestas: { 'hippocampus|ubicacion|es': otra } });
    useAtlas.getState().proponerPosicion(posicion, 'stomach');
    useAtlas.getState().deshacerPosicion(M);
    const s = useAtlas.getState();
    expect(Object.keys(s.respuestas)).toEqual(['hippocampus|ubicacion|es']);
    expect(s.piezaPropuesta[M]).toBeUndefined();
    expect(s.ubicando).toBe(M);
  });

  it('deshacer sin propuesta previa no falla ni cambia las respuestas', () => {
    useAtlas.setState({ respuestas: { 'hippocampus|ubicacion|es': otra }, ubicando: null });
    expect(() => useAtlas.getState().deshacerPosicion(M)).not.toThrow();
    const s = useAtlas.getState();
    expect(Object.keys(s.respuestas)).toEqual(['hippocampus|ubicacion|es']);
    expect(s.ubicando).toBe(M);
  });

  it('cargar respuestas olvida las piezas tocadas', () => {
    useAtlas.getState().proponerPosicion(posicion, 'stomach');
    const antes = useAtlas.getState().cargaRespuestas;
    useAtlas.getState().cargarRespuestas({});
    expect(useAtlas.getState().piezaPropuesta).toEqual({});
    expect(useAtlas.getState().cargaRespuestas).toBe(antes + 1);
  });

  it('importar respuestas (las que trae el canal al abrir) conserva la pieza de la posición que no cambió y olvida la de la que reemplazó', () => {
    const N = 'm-otro-marcador';
    const vieja = { ...posicion, estructura: N };
    useAtlas.getState().proponerPosicion(posicion, 'stomach');
    useAtlas.getState().proponerPosicion(vieja, 'liver');
    const antes = useAtlas.getState().cargaRespuestas;
    const nueva = { ...vieja, posicion: [9, 9, 9] as [number, number, number], fecha: '2026-10-12T00:00:00Z' };
    expect(useAtlas.getState().importarRespuestas([nueva, otra])).toEqual({ agregadas: 1, actualizadas: 1, sinCambio: 0 });
    const s = useAtlas.getState();
    expect(s.respuestas[`${N}|posicion|`]).toBe(nueva);
    expect(s.piezaPropuesta).toEqual({ [M]: 'stomach' });
    expect(s.cargaRespuestas).toBe(antes + 1);
    // Sin cambios no se recarga: ni el contador ni las piezas se tocan.
    expect(useAtlas.getState().importarRespuestas([nueva, otra])).toEqual({ agregadas: 0, actualizadas: 0, sinCambio: 2 });
    expect(useAtlas.getState().cargaRespuestas).toBe(antes + 1);
    expect(useAtlas.getState().piezaPropuesta).toEqual({ [M]: 'stomach' });
  });
});

describe('trazos del vago (#62)', () => {
  const MALLA = 'Vagus nerve (X).r#t03';
  beforeEach(() => {
    useAtlas.setState({
      seleccion: { entrada: null, pieza: null, malla: null },
      aislar: null,
      recorrido: null,
      camara: null,
      trazos: [],
    });
  });

  it('abrirTrazo selecciona la malla, deja el vago en contexto y pide encuadrarla', () => {
    useAtlas.getState().abrirTrazo(MALLA);
    const s = useAtlas.getState();
    expect(s.seleccion).toEqual({ entrada: 'vagus-nerve-x', pieza: 'vagus-nerve-x-r', malla: MALLA });
    expect(s.aislar?.modo).toBe('contexto');
    expect([...s.aislar!.piezas].sort()).toEqual([...piezasDeEntrada('vagus-nerve-x')].sort());
    expect(s.camara?.malla).toBe(MALLA);
  });

  it('en el recorrido no toca el aislamiento, que es del recorrido', () => {
    const previo = { modo: 'contexto' as const, piezas: new Set(['vagus-nerve-x-l']) };
    useAtlas.setState({ recorrido: 2, aislar: previo });
    useAtlas.getState().abrirTrazo(MALLA);
    expect(useAtlas.getState().aislar).toBe(previo);
    expect(useAtlas.getState().seleccion.malla).toBe(MALLA);
  });

  it('una malla desconocida no cambia la selección ni la cámara', () => {
    useAtlas.getState().abrirTrazo('Malla que no existe#t00');
    const s = useAtlas.getState();
    expect(s.seleccion).toEqual({ entrada: null, pieza: null, malla: null });
    expect(s.camara).toBeNull();
    expect(s.aislar).toBeNull();
  });

  it('setTrazos guarda la lista y una lista igual no notifica', () => {
    const lista = ['Vagus nerve (X).l#t00', 'Vagus nerve (X).l#t01'];
    useAtlas.getState().setTrazos(lista);
    expect(useAtlas.getState().trazos).toEqual(lista);
    let avisos = 0;
    const baja = useAtlas.subscribe(() => {
      avisos += 1;
    });
    useAtlas.getState().setTrazos([...lista]);
    expect(avisos).toBe(0);
    useAtlas.getState().setTrazos([lista[0]!]);
    expect(avisos).toBe(1);
    baja();
  });
});

describe('cortes (F8)', () => {
  const vago = piezasBajo(GRUPO_VAGO)[0]!;
  const muchos = Object.fromEntries(
    ['amygdaloid-body-l', 'amygdaloid-body-r', 'superior-frontal-gyrus-l', 'superior-frontal-gyrus-r'].map((p, i) => [
      p,
      [(i % 2 ? -1 : 1) * 0.03, 1.62 + i * 0.01, 0.02] as Vec3,
    ]),
  );
  const todosCentros: Record<string, Vec3> = { ...centros, ...muchos };
  const cajas: Record<string, Caja> = {
    ...Object.fromEntries(
      Object.entries(todosCentros).map(([p, c]) => [
        p,
        [
          [c[0] - 0.02, c[1] - 0.03, c[2] - 0.04],
          [c[0] + 0.02, c[1] + 0.03, c[2] + 0.04],
        ] as Caja,
      ]),
    ),
    [vago]: [
      [-0.2, 0.5, -0.3],
      [0.2, 1.6, 0.3],
    ],
  };
  const rango = rangoCerebro(cajas, piezasEncefalo);
  const piezasProbadas = [...Object.keys(centros), vago, 'vagus-nerve-x-l', 'vagus-nerve-x-r'];

  const objetivos = () => piezasProbadas.map((p) => objetivo(useAtlas.getState(), p));
  const cuentaNotificaciones = () => {
    let n = 0;
    const baja = useAtlas.subscribe(() => {
      n += 1;
    });
    return { baja, n: () => n };
  };

  beforeEach(() => {
    useAtlas.setState({
      ocultas: new Set(),
      aislar: null,
      explosion: 0,
      nivel: 'piezas',
      separadas: {},
      devueltas: new Set(),
      grupoActivo: null,
      seleccion: { entrada: null, pieza: null, malla: null },
      cortes: cortesApagados(),
      fantasmaCorte: false,
      rellenoApagado: false,
    });
    useAtlas.getState().setCentros(centros, cajas);
  });

  it('R5.1: el estado inicial tiene los tres planos inactivos, sin fantasma y con relleno', () => {
    const s = useAtlas.getState();
    expect(s.cortes).toEqual(cortesApagados());
    expect(s.fantasmaCorte).toBe(false);
    expect(s.rellenoApagado).toBe(false);
    const inicial = useAtlas.getInitialState();
    expect(inicial.cortes).toEqual(cortesApagados());
    expect(inicial.fantasmaCorte).toBe(false);
    expect(inicial.rellenoApagado).toBe(false);
  });

  it('R1.3: activar un plano inactivo lo deja en 0 mm aunque antes tuviera otro valor', () => {
    useAtlas.setState({ cortes: { ...cortesApagados(), coronal: { activo: false, mm: 15, invertido: false } } });
    useAtlas.getState().setCorte('coronal', { activo: true });
    const { cortes } = useAtlas.getState();
    expect(cortes.coronal).toEqual({ activo: true, mm: 0, invertido: false });
    expect(cortes.sagital.activo).toBe(false);
    expect(cortes.axial.activo).toBe(false);
  });

  it('activar con mm explícito conserva ese mm', () => {
    useAtlas.getState().setCorte('axial', { activo: true, mm: 5 });
    expect(useAtlas.getState().cortes.axial).toEqual({ activo: true, mm: 5, invertido: false });
  });

  it('R1.6: invertir cambia solo invertido y conserva activo y mm', () => {
    useAtlas.getState().setCorte('sagital', { activo: true, mm: 7 });
    useAtlas.getState().setCorte('sagital', { invertido: true });
    expect(useAtlas.getState().cortes.sagital).toEqual({ activo: true, mm: 7, invertido: true });
  });

  it('D1: mm se ajusta al rango del encéfalo, el vago no lo agranda y un valor no finito se ignora', () => {
    expect(rango.max.axial).toBeGreaterThan(0);
    expect(rangoCerebro(cajas, Object.keys(cajas)).max.axial).toBeGreaterThan(rango.max.axial);
    const { setCorte } = useAtlas.getState();
    setCorte('axial', { activo: true });
    setCorte('axial', { mm: 9999 });
    expect(useAtlas.getState().cortes.axial.mm).toBe(rango.max.axial);
    setCorte('axial', { mm: -9999 });
    expect(useAtlas.getState().cortes.axial.mm).toBe(rango.min.axial);
    setCorte('axial', { mm: 3.6 });
    expect(useAtlas.getState().cortes.axial.mm).toBe(4);
    setCorte('axial', { mm: NaN });
    expect(useAtlas.getState().cortes.axial.mm).toBe(4);
  });

  it('R2.2: activar el primer plano arma el cerebro en una sola notificación', () => {
    useAtlas.getState().setCentros({ ...centros, ...muchos }, cajas);
    useAtlas.getState().setExplosion(1);
    useAtlas.getState().separar(['thalamus-r']);
    useAtlas.getState().devolver(['thalamus-l']);
    const antes = useAtlas.getState();
    expect(antes.explosion).toBe(1);
    expect(antes.inventario).toBe(true);
    expect(Object.keys(antes.separadas)).toEqual(['thalamus-r']);
    expect(antes.devueltas.size).toBe(1);

    const cuenta = cuentaNotificaciones();
    useAtlas.getState().setCorte('coronal', { activo: true });
    cuenta.baja();
    expect(cuenta.n()).toBe(1);
    const st = useAtlas.getState();
    expect(st.explosion).toBe(0);
    expect(st.separadas).toEqual({});
    expect(st.devueltas.size).toBe(0);
    expect(st.inventario).toBe(false);
    expect(st.cortes.coronal.activo).toBe(true);
    for (const p of Object.keys(todosCentros)) expect(objetivo(st, p)).toEqual([0, 0, 0]);
  });

  it('con un corte activo, setExplosion y separar no notifican ni cambian nada', () => {
    useAtlas.getState().setCorte('coronal', { activo: true });
    const antes = useAtlas.getState();
    const cuenta = cuentaNotificaciones();
    useAtlas.getState().setExplosion(0.8);
    useAtlas.getState().separar(['thalamus-l']);
    cuenta.baja();
    expect(cuenta.n()).toBe(0);
    const st = useAtlas.getState();
    expect(st.explosion).toBe(0);
    expect(st.separadas).toBe(antes.separadas);
    expect(st.devueltas).toBe(antes.devueltas);
    expect(st.base).toBe(antes.base);
  });

  it('R1.8 y R2.4: quitarCortes apaga los tres planos y rehabilita explosión y Separar', () => {
    const { setCorte } = useAtlas.getState();
    setCorte('sagital', { activo: true });
    setCorte('axial', { activo: true, mm: 3, invertido: true });
    useAtlas.getState().quitarCortes();
    expect(useAtlas.getState().cortes).toEqual(cortesApagados());
    useAtlas.getState().setExplosion(0.5);
    expect(useAtlas.getState().explosion).toBe(0.5);
    useAtlas.getState().separar(['thalamus-l']);
    expect(fueraDeSitio(useAtlas.getState(), 'thalamus-l')).toBe(true);
  });

  it('R2.4: con dos planos activos, desactivar uno mantiene el bloqueo y desactivar el último lo quita', () => {
    const { setCorte } = useAtlas.getState();
    setCorte('coronal', { activo: true });
    setCorte('axial', { activo: true });
    setCorte('coronal', { activo: false });
    useAtlas.getState().setExplosion(0.7);
    expect(useAtlas.getState().explosion).toBe(0);
    setCorte('axial', { activo: false });
    useAtlas.getState().setExplosion(0.7);
    expect(useAtlas.getState().explosion).toBe(0.7);
    useAtlas.getState().separar(['thalamus-r']);
    expect(fueraDeSitio(useAtlas.getState(), 'thalamus-r')).toBe(true);
  });

  it.each(['quitar', 'desactivar'] as const)('R2.5: objetivo no cambia al activar, mover, invertir, sumar planos y %s', (cierre) => {
    useAtlas.getState().setCentros(todosCentros, cajas);
    useAtlas.getState().alternarVisibles(['hippocampus-l'], false);
    useAtlas.getState().aislarPiezas(['thalamus-l', 'thalamus-r', 'amygdaloid-body-l', 'amygdaloid-body-r'], 'solo');
    const referencia = objetivos();
    const baseRef = useAtlas.getState().base;
    const igual = () => {
      const st = useAtlas.getState();
      expect(st.explosion).toBe(0);
      expect(st.base).toEqual(baseRef);
      expect(objetivos()).toEqual(referencia);
    };
    const { setCorte } = useAtlas.getState();
    setCorte('coronal', { activo: true });
    igual();
    setCorte('coronal', { mm: 10 });
    igual();
    setCorte('coronal', { invertido: true });
    igual();
    setCorte('axial', { activo: true });
    igual();
    if (cierre === 'quitar') useAtlas.getState().quitarCortes();
    else {
      setCorte('coronal', { activo: false });
      setCorte('axial', { activo: false });
    }
    igual();
  });

  it('R2.6: ocultas, aislar y grupoActivo conservan su referencia al activar, mover y quitar cortes', () => {
    useAtlas.getState().alternarVisibles(['hippocampus-l'], false);
    useAtlas.getState().aislarPiezas(['thalamus-l', 'thalamus-r'], 'solo');
    useAtlas.setState({ grupoActivo: 'sistema-limbico' });
    const { ocultas, aislar } = useAtlas.getState();
    const visibles = piezasVisibles(useAtlas.getState());
    const mismo = () => {
      const st = useAtlas.getState();
      expect(st.ocultas).toBe(ocultas);
      expect(st.aislar).toBe(aislar);
      expect(st.grupoActivo).toBe('sistema-limbico');
      expect(piezasVisibles(st)).toEqual(visibles);
    };
    useAtlas.getState().setCorte('sagital', { activo: true });
    mismo();
    useAtlas.getState().setCorte('sagital', { mm: 12 });
    mismo();
    useAtlas.getState().quitarCortes();
    mismo();
  });

  it('D3: con un plano activo, otro setCorte no reemplaza separadas ni devueltas', () => {
    useAtlas.getState().setCorte('coronal', { activo: true });
    const { separadas, devueltas } = useAtlas.getState();
    useAtlas.getState().setCorte('axial', { activo: true });
    useAtlas.getState().setCorte('coronal', { mm: 3 });
    expect(useAtlas.getState().separadas).toBe(separadas);
    expect(useAtlas.getState().devueltas).toBe(devueltas);
  });

  it('D2: fantasma y relleno son idempotentes y quitarCortes no los toca', () => {
    useAtlas.getState().setFantasmaCorte(true);
    expect(useAtlas.getState().fantasmaCorte).toBe(true);
    const cuenta = cuentaNotificaciones();
    useAtlas.getState().setFantasmaCorte(true);
    expect(cuenta.n()).toBe(0);
    useAtlas.getState().apagarRelleno();
    expect(useAtlas.getState().rellenoApagado).toBe(true);
    expect(cuenta.n()).toBe(1);
    useAtlas.getState().apagarRelleno();
    cuenta.baja();
    expect(cuenta.n()).toBe(1);
    useAtlas.getState().setCorte('coronal', { activo: true });
    useAtlas.getState().quitarCortes();
    expect(useAtlas.getState().fantasmaCorte).toBe(true);
    expect(useAtlas.getState().rellenoApagado).toBe(true);
    useAtlas.getState().setFantasmaCorte(false);
    expect(useAtlas.getState().fantasmaCorte).toBe(false);
  });
});

describe('vista activa de la brújula (#213)', () => {
  beforeEach(() => {
    useAtlas.setState({ vistaActiva: null, camara: null });
  });

  it('una vista pedida queda activa', () => {
    useAtlas.getState().pedirCamara({ vista: 'superior' });
    expect(useAtlas.getState().vistaActiva).toBe('superior');
  });

  it('encuadrar, ir a una malla o a una parada del recorrido conserva la dirección y la marca', () => {
    useAtlas.getState().pedirCamara({ vista: 'superior' });
    useAtlas.getState().pedirCamara({ encuadrar: ['thalamus-l'] });
    expect(useAtlas.getState().vistaActiva).toBe('superior');
    useAtlas.getState().pedirCamara({ malla: 'vagus-nerve-x-l' });
    expect(useAtlas.getState().vistaActiva).toBe('superior');
    useAtlas.getState().irAParada(0);
    expect(useAtlas.getState().camara?.encuadrar?.length).toBeGreaterThan(0);
    expect(useAtlas.getState().vistaActiva).toBe('superior');
  });

  it('encuadrar sin vista previa no inventa una vista', () => {
    useAtlas.getState().pedirCamara({ encuadrar: ['thalamus-l'] });
    expect(useAtlas.getState().vistaActiva).toBeNull();
  });

  it('una pose libre (camara) desmarca', () => {
    useAtlas.getState().pedirCamara({ vista: 'posterior' });
    useAtlas.getState().pedirCamara({ camara: [1, 2, 3, 0, 0, 0] });
    expect(useAtlas.getState().vistaActiva).toBeNull();
  });

  it('una vista con encuadre (Fragmentar) queda activa', () => {
    useAtlas.getState().pedirCamara({ vista: 'anterior', encuadrar: ['thalamus-l'] });
    expect(useAtlas.getState().vistaActiva).toBe('anterior');
  });

  it('setVistaActiva fija y borra la vista, y no notifica si no cambia', () => {
    useAtlas.getState().setVistaActiva('inferior');
    expect(useAtlas.getState().vistaActiva).toBe('inferior');
    let n = 0;
    const baja = useAtlas.subscribe(() => (n += 1));
    useAtlas.getState().setVistaActiva('inferior');
    expect(n).toBe(0);
    useAtlas.getState().setVistaActiva(null);
    baja();
    expect(n).toBe(1);
    expect(useAtlas.getState().vistaActiva).toBeNull();
  });
});
