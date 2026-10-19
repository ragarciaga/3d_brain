// Ficha de pieza (F4), recursos (F9) y controles de revisión por campo (F24).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dudas, esFragmentable, estructuras, origenDe, grupos, marcadorPorId, nodos, padreDeEntrada, piezasDeEntrada, PENDIENTE } from '../data/atlas';
import type { Estructura, Fuente, Idioma, Recurso } from '../data/tipos';
import { latinVisible, nombre, nombreNodo, nombrePendiente, nombrePieza } from '../lib/nombres';
import { hayCortes } from '../lib/cortes';
import { campoTrazado } from '../lib/rutas';
import { ENTRADA_VAGO } from '../lib/trazos';
import { enlacesArticulos } from '../lib/articulos';
import { accionAlPulsar, estadoAislar, estadoOcultar, estadoSeparar, propsPulsado, type Pulsado } from '../lib/alternar';
import {
  cambiosDeTexto,
  claveRespuesta,
  ESPERA_GUARDADO_MS,
  pendientesComoCorrectas,
  posicionConfirmable,
  propuestaDePosicion,
  respuestaCompleta,
  type Veredicto,
} from '../lib/revision';
import { camposDeFicha } from '../lib/prioridad';
import { useAtlas, vagoVisible } from '../store/useAtlas';
import { colorDePieza } from './colores';
import ReportarError from './ReportarError';
import RevisionTrazo from './RevisionTrazo';
import { CONSULTA_MOVIL } from './useMovil';

const otro = (i: Idioma): Idioma => (i === 'es' ? 'en' : 'es');

function ControlRevision({
  entrada,
  campo,
  idioma,
  version,
  etiqueta,
}: {
  entrada: string;
  campo: string;
  idioma?: Idioma;
  version: string;
  etiqueta?: string; // qué se juzga, cuando hay varios controles seguidos (nombres)
}) {
  const { t } = useTranslation();
  const clave = claveRespuesta({ estructura: entrada, campo, idioma });
  const r = useAtlas((s) => s.respuestas[clave]);
  // El componente se monta con key={clave}: el texto nunca pasa de un campo o estructura a otro. La key
  // también cambia cuando llegan las respuestas guardadas, para que el texto inicial salga de IndexedDB.
  const [texto, setTexto] = useState(r?.propuesta ?? '');
  const [comentario, setComentario] = useState(r?.comentario ?? '');
  const idPropuesta = useId();
  const idAyuda = useId();
  const idAviso = useId();
  const idComentario = useId();
  const incompleta = r?.veredicto === 'corregir' && !texto.trim();

  // Lo que se escribe se guarda tras una pausa, sin esperar a que el docente salga del campo.
  useEffect(() => {
    if (!r) return;
    const cambios = cambiosDeTexto(r, texto, comentario);
    if (!cambios) return;
    const espera = setTimeout(
      () =>
        useAtlas.getState().responder({
          estructura: entrada,
          campo,
          idioma,
          veredicto: r.veredicto,
          propuesta: cambios.propuesta,
          comentario: cambios.comentario,
          version,
          fecha: new Date().toISOString(),
        }),
      ESPERA_GUARDADO_MS,
    );
    return () => clearTimeout(espera);
  }, [r, texto, comentario, entrada, campo, idioma, version]);

  const responder = (veredicto: Veredicto, propuesta?: string, nota?: string) =>
    useAtlas.getState().responder({
      estructura: entrada,
      campo,
      idioma,
      veredicto,
      propuesta: propuesta || undefined,
      comentario: nota || undefined,
      version,
      fecha: new Date().toISOString(),
    });
  return (
    <div className="revision-control" data-campo={`${campo}${idioma ? `.${idioma}` : ''}`}>
      {etiqueta && <p className="revision-etiqueta">{etiqueta}</p>}
      <div className="revision-botones" role="group" aria-label={t('revision.veredicto')}>
        {(['correcto', 'corregir', 'no_es_mi_area'] as Veredicto[]).map((v) => (
          <button
            key={v}
            type="button"
            className={`chip chip-${v}${r?.veredicto === v ? ' activo' : ''}`}
            aria-pressed={r?.veredicto === v}
            onClick={() =>
              r?.veredicto === v ? useAtlas.getState().borrarRespuesta(clave) : responder(v, v === 'corregir' ? texto : undefined, comentario)
            }
          >
            {t(`revision.${v}`)}
          </button>
        ))}
      </div>
      {r?.veredicto === 'corregir' && (
        <>
          <label htmlFor={idPropuesta}>{t('revision.propuesta')}</label>
          <p id={idAyuda} className="recurso-nota">
            {t('revision.propuestaAyuda')}
          </p>
          {incompleta && (
            <p id={idAviso} className="etiqueta-aviso" data-testid="revision-incompleta">
              {t('revision.incompleta')}
            </p>
          )}
          <textarea
            id={idPropuesta}
            aria-describedby={incompleta ? `${idAyuda} ${idAviso}` : idAyuda}
            aria-invalid={incompleta || undefined}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => responder('corregir', texto, comentario)}
            rows={3}
          />
        </>
      )}
      {r && (
        <>
          <label htmlFor={idComentario}>{t('revision.comentario')}</label>
          <textarea
            id={idComentario}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onBlur={() => responder(r.veredicto, r.veredicto === 'corregir' ? texto : undefined, comentario)}
            rows={2}
          />
        </>
      )}
    </div>
  );
}

/** Posición ya propuesta para un marcador (F24): sobre qué pieza cayó el toque, Deshacer y un comentario. */
function PropuestaPosicion({ entrada, idioma }: { entrada: string; idioma: Idioma }) {
  const { t } = useTranslation();
  const respuestas = useAtlas((s) => s.respuestas);
  const piezaPropuesta = useAtlas((s) => s.piezaPropuesta);
  const idComentario = useId();
  const p = propuestaDePosicion(respuestas, piezaPropuesta, entrada);
  if (!p) return null;
  return (
    <div className="revision-control" data-testid="posicion-propuesta" data-pieza={p.pieza ?? ''}>
      <p role="status">{p.pieza ? t('revision.posicionSobre', { pieza: nombrePieza(p.pieza, idioma, t) }) : t('revision.posicionYaPropuesta')}</p>
      <button type="button" onClick={() => useAtlas.getState().deshacerPosicion(entrada)}>
        {t('revision.deshacer')}
      </button>
      <label htmlFor={idComentario}>{t('revision.comentario')}</label>
      <textarea
        id={idComentario}
        rows={2}
        maxLength={4000} // el mismo tope (MAX_TEXTO_LARGO en src/lib/revision.ts) que valida el importador; si no, el envío se descarta
        value={p.respuesta.comentario ?? ''}
        onChange={(ev) => useAtlas.getState().responder({ ...p.respuesta, comentario: ev.target.value || undefined })}
      />
    </div>
  );
}

/**
 * "Correcto" para la posición aproximada de un marcador (F24): un toque guarda `posicion/correcto` sin
 * coordenadas, con la misma clave que "Proponer posición"; otro toque la borra.
 */
function PosicionCorrecta({ id, version }: { id: string; version: string }) {
  const { t } = useTranslation();
  const clave = claveRespuesta({ estructura: id, campo: 'posicion' });
  const activo = useAtlas((s) => s.respuestas[clave]?.veredicto === 'correcto');
  const alPulsar = () => {
    const st = useAtlas.getState();
    if (activo) {
      st.borrarRespuesta(clave);
      return;
    }
    st.responder({ estructura: id, campo: 'posicion', veredicto: 'correcto', version, fecha: new Date().toISOString() });
    if (st.ubicando === id) st.setUbicando(null);
  };
  return (
    <button type="button" data-testid="posicion-correcta" className={`chip chip-correcto${activo ? ' activo' : ''}`} aria-pressed={activo} onClick={alPulsar}>
      {t('revision.posicionCorrecta')}
    </button>
  );
}

/**
 * "Marcar todo como correcto" (#66): responde `correcto` los campos de la ficha que aún no tienen respuesta
 * de ningún tipo. Pide confirmación y no toca lo ya respondido, ni un "Corregir" que aún no tiene texto.
 */
function MarcarTodo({ id, idioma, version }: { id: string; idioma: Idioma; version: string }) {
  const { t } = useTranslation();
  const rutas = useAtlas((s) => s.rutas);
  const vago = useAtlas(vagoVisible);
  const respuestas = useAtlas((s) => s.respuestas);
  const [confirmando, setConfirmando] = useState(false);
  const [hechos, setHechos] = useState<number | null>(null);
  const refBoton = useRef<HTMLButtonElement>(null);
  const refCancelar = useRef<HTMLButtonElement>(null);
  const refEstado = useRef<HTMLParagraphElement>(null);
  const siguienteFoco = useRef<'cancelar' | 'boton' | 'estado' | null>(null);

  useEffect(() => {
    const destino = siguienteFoco.current;
    siguienteFoco.current = null;
    if (destino === 'cancelar') refCancelar.current?.focus();
    else if (destino === 'boton') refBoton.current?.focus();
    else if (destino === 'estado') refEstado.current?.focus();
  }, [confirmando, hechos]);

  const campos = camposDeFicha(id, idioma, rutas, vago);
  // La fecha real se pone al confirmar; aquí solo importa cuántas faltan.
  const pendientes = pendientesComoCorrectas(campos, respuestas, version, '');
  const incompletas = campos.filter((k) => respuestas[k] && !respuestaCompleta(respuestas[k])).length;

  const confirmar = () => {
    const vigente = useAtlas.getState();
    const nuevas = pendientesComoCorrectas(camposDeFicha(id, idioma, vigente.rutas, vagoVisible(vigente)), vigente.respuestas, version, new Date().toISOString());
    for (const r of nuevas) vigente.responder(r);
    siguienteFoco.current = 'estado';
    setHechos(nuevas.length);
    setConfirmando(false);
  };

  return (
    <div className="marcar-todo" data-testid="marcar-todo">
      {confirmando ? (
        <>
          <p>{t('revision.marcarTodoConfirmar', { count: pendientes.length })}</p>
          {incompletas > 0 && <p>{t('revision.marcarTodoIncompletas', { count: incompletas })}</p>}
          <button type="button" className="boton-primario" onClick={confirmar}>
            {t('revision.marcarTodoSi', { count: pendientes.length })}
          </button>
          <button
            type="button"
            ref={refCancelar}
            onClick={() => {
              siguienteFoco.current = 'boton';
              setConfirmando(false);
            }}
          >
            {t('revision.marcarTodoCancelar')}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            ref={refBoton}
            disabled={pendientes.length === 0}
            onClick={() => {
              siguienteFoco.current = 'cancelar';
              setHechos(null);
              setConfirmando(true);
            }}
          >
            {t('revision.marcarTodo')}
          </button>
          {hechos !== null && (
            <p role="status" tabIndex={-1} ref={refEstado}>
              {t('revision.marcarTodoHecho', { count: hechos })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Campo({ titulo, children, revision }: { titulo: string; children: ReactNode; revision?: ReactNode }) {
  return (
    <section className="ficha-campo">
      <h3>{titulo}</h3>
      {children}
      {revision}
    </section>
  );
}

function ListaFuentes({ fuentes }: { fuentes: Fuente[] }) {
  const { t } = useTranslation();
  return (
    <ul className="fuentes">
      {fuentes.map((f, i) => (
        <li key={i}>
          {f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer">
              {f.cita}
            </a>
          ) : (
            f.cita
          )}
          {f.verificada === false && <span className="etiqueta-aviso"> {t('ficha.porVerificar')}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Recursos heredados de los grupos padre en el árbol (F9). */
function recursosHeredados(id: string): Recurso[] {
  const res: Recurso[] = [];
  let p = padreDeEntrada(id);
  while (p) {
    res.push(...(estructuras[p]?.ficha?.recursos ?? []));
    p = nodos[p]?.padre ?? null;
  }
  const vistos = new Set<string>();
  return res.filter((r) => (vistos.has(r.url) ? false : (vistos.add(r.url), true)));
}

function Recursos({ propios, heredados, idioma }: { propios: Recurso[]; heredados: Recurso[]; idioma: Idioma }) {
  const { t } = useTranslation();
  const [soloMiIdioma, setSoloMiIdioma] = useState(false);
  const filtrar = (l: Recurso[]) => (soloMiIdioma ? l.filter((r) => r.idioma === idioma) : l);
  const item = (r: Recurso, i: number) => (
    <li key={`${r.url}-${i}`}>
      <a className="tarjeta-enlace" href={r.url} target="_blank" rel="noopener noreferrer">
        <span className="tarjeta-etiquetas">
          <span className="recurso-tipo">{t(`recurso.${r.tipo}`)}</span>
          {r.idioma !== idioma && <span className="recurso-idioma">{t(`idioma.en_${r.idioma}`)}</span>}
        </span>
        <strong>{r.titulo}</strong>
        <span className="recurso-nota">{r.nota[idioma]}</span>
      </a>
    </li>
  );
  if (!propios.length && !heredados.length) return null;
  const mezcla = [...propios, ...heredados].some((r) => r.idioma !== idioma);
  return (
    <>
      {mezcla && (
        <label className="interruptor interruptor-pequeno">
          <input type="checkbox" checked={soloMiIdioma} onChange={(e) => setSoloMiIdioma(e.target.checked)} />{' '}
          {t('ficha.soloMiIdioma')}
        </label>
      )}
      {propios.length > 0 && <ul className="tarjetas recursos">{filtrar(propios).map(item)}</ul>}
      {heredados.length > 0 && (
        <details className="recursos-grupo" open={!propios.length}>
          <summary>
            {t('ficha.delGrupo')} ({filtrar(heredados).length})
          </summary>
          <ul className="tarjetas recursos">{filtrar(heredados).map(item)}</ul>
        </details>
      )}
    </>
  );
}

function Acciones({ id, alCompartir }: { id: string; alCompartir: () => void }) {
  const { t } = useTranslation();
  const piezas = piezasDeEntrada(id);
  const s = useAtlas.getState;
  // Los hooks van antes del retorno temprano: el orden de hooks no puede depender de si hay piezas.
  const aislado = useAtlas((st) => estadoAislar(st.aislar, 'solo', piezas));
  const conContexto = useAtlas((st) => estadoAislar(st.aislar, 'contexto', piezas));
  const separado = useAtlas((st) => estadoSeparar(st.separadas, st.devueltas, piezas));
  const oculto = useAtlas((st) => estadoOcultar(st.ocultas, piezas));
  // Con cortes no se separa (el store ya lo ignora): el botón queda deshabilitado y se dice por qué.
  const conCortes = useAtlas((st) => hayCortes(st.cortes));
  const idNota = useId();
  if (!piezas.length) {
    return (
      <div className="acciones">
        <button type="button" onClick={alCompartir}>
          {t('acciones.compartir')}
        </button>
      </div>
    );
  }
  // El vago no se separa (F6, ADR 0009): en su lugar, el recorrido guiado (F14).
  const nervio = piezas.every((p) => !esFragmentable(p));
  const alternarAislar = (estado: Pulsado, modo: 'solo' | 'contexto') => () =>
    accionAlPulsar(estado) === 'desactivar' ? s().salirAislar() : s().aislarPiezas(piezas, modo);
  return (
    <div className="acciones" role="group" aria-label={t('acciones.titulo')}>
      <button type="button" {...propsPulsado(aislado)} onClick={alternarAislar(aislado, 'solo')}>
        {t('acciones.aislar')}
      </button>
      <button type="button" {...propsPulsado(conContexto)} onClick={alternarAislar(conContexto, 'contexto')}>
        {t('acciones.aislarContexto')}
      </button>
      {nervio ? (
        <button
          type="button"
          className="boton-primario"
          data-testid="iniciar-recorrido"
          title={t('acciones.noSepara')}
          onClick={() => {
            s().iniciarRecorrido();
            // La ficha se cierra para dejar el nervio a la vista; el panel del recorrido enlaza a cada ficha.
            window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: null } }));
          }}
        >
          {t('acciones.recorrer')}
        </button>
      ) : (
        <button
          type="button"
          {...propsPulsado(separado)}
          disabled={conCortes}
          aria-describedby={conCortes ? idNota : undefined}
          onClick={() => {
            if (accionAlPulsar(separado) === 'desactivar') s().devolver(piezas);
            else s().separar(piezas);
            // La cámara suele estar muy cerca de la estructura: sin reencuadrar, las piezas separadas
            // quedan detrás de ella o fuera del lienzo (#19). Se encuadra sin girar.
            s().pedirCamara({ encuadrar: piezas });
          }}
        >
          {t('acciones.separar')}
        </button>
      )}
      {!nervio && conCortes && (
        <p id={idNota} className="cortes-bloqueados acciones-nota" data-testid="separar-bloqueado">
          {t('cortes.bloqueados')}
        </p>
      )}
      {/* Segundo toque: las vuelve a mostrar. */}
      <button type="button" {...propsPulsado(oculto)} onClick={() => s().alternarVisibles(piezas, accionAlPulsar(oculto) === 'desactivar')}>
        {t('acciones.ocultar')}
      </button>
      <button type="button" onClick={() => s().pedirCamara({ encuadrar: piezas })}>
        {t('acciones.encuadrar')}
      </button>
      <button type="button" onClick={alCompartir}>
        {t('acciones.compartir')}
      </button>
    </div>
  );
}

/** Búsquedas de artículos científicos por el nombre de la entrada (F9); salen aunque la ficha esté en preparación. */
function Articulos({ nombreEn, nombreEs }: { nombreEn: string; nombreEs: string }) {
  const { t } = useTranslation();
  const enlaces = enlacesArticulos(nombreEn, nombreEs);
  if (!enlaces.length) return null;
  return (
    <div data-testid="articulos">
      <h4>{t('ficha.articulos.titulo')}</h4>
      <ul className="tarjetas articulos">
        {enlaces.map((l) => (
          <li key={l.base}>
            <a className="tarjeta-enlace" href={l.url} target="_blank" rel="noopener noreferrer" data-base={l.base}>
              <strong>{t(`ficha.articulos.${l.base}`)}</strong>
              <span className="recurso-nota">{t(`ficha.articulos.${l.base}Desc`)}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="recurso-nota">{t('ficha.articulos.nota')}</p>
    </div>
  );
}

/** Grupos de estudio que incluyen la entrada, con sus fuentes (sin convertirlas en recursos). */
function GruposDeLaEntrada({ id, idioma }: { id: string; idioma: Idioma }) {
  const { t } = useTranslation();
  const piezas = new Set(piezasDeEntrada(id));
  const lista = grupos.filter(
    (g) => g.miembros.includes(id) || (piezas.size > 0 && g.miembros.some((m) => piezasDeEntrada(m).some((x) => piezas.has(x)))),
  );
  if (!lista.length) return null;
  return (
    <p className="ficha-grupos">
      <span className="solo-lector">{t('ficha.gruposDeEstudio')}: </span>
      {lista.map((g) => (
        <span key={g.id} className="etiqueta-grupo">
          {g.nombre[idioma]}
        </span>
      ))}
    </p>
  );
}

export default function Ficha({ idioma, alCompartir, alCerrar }: { idioma: Idioma; alCompartir: () => void; alCerrar: () => void }) {
  const { t } = useTranslation();
  const seleccion = useAtlas((s) => s.seleccion);
  const revisor = useAtlas((s) => s.revisor);
  const ubicando = useAtlas((s) => s.ubicando);
  const rutas = useAtlas((s) => s.rutas);
  const hayHuecos = useAtlas((s) => s.huecos.length > 0);
  // Filtro del vago (spec 03, R5): sin la casilla (con canal) no se muestran el control de trazo ni el de rutas trazadas.
  const vago = useAtlas(vagoVisible);
  const enfocar = useAtlas((s) => s.enfocarFicha);
  const respuestas = useAtlas((s) => s.respuestas);
  const piezaPropuesta = useAtlas((s) => s.piezaPropuesta);
  const cargaRespuestas = useAtlas((s) => s.cargaRespuestas);
  const id = seleccion.entrada;
  const yaPropuesta = !!id && !!propuestaDePosicion(respuestas, piezaPropuesta, id);
  const e: Estructura | undefined = id ? estructuras[id] : undefined;
  const ficha = useRef<HTMLElement>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);

  // Elegir desde la búsqueda, el árbol o una relación lleva el foco al título de la ficha, que así se anuncia.
  useEffect(() => {
    if (!enfocar || enfocar !== id || !refTitulo.current) return;
    refTitulo.current.focus({ preventScroll: true });
    useAtlas.getState().pedirFocoFicha(null);
  }, [enfocar, id]);

  // En celular la ficha es una hoja inferior: el visor necesita su alto para no dejar el objetivo detrás.
  useEffect(() => {
    const el = ficha.current;
    const mq = window.matchMedia(CONSULTA_MOVIL);
    const medir = () => useAtlas.getState().setHoja(id && el && mq.matches ? Math.round(el.getBoundingClientRect().height) : 0);
    medir();
    mq.addEventListener('change', medir);
    const ro = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(medir);
    if (el) ro?.observe(el);
    return () => {
      mq.removeEventListener('change', medir);
      ro?.disconnect();
      useAtlas.getState().setHoja(0);
    };
  }, [id, e]);

  if (!id || !e) {
    return (
      <aside id="panel-ficha" className="ficha ficha-vacia" aria-label={t('ficha.titulo')}>
        <p>{t('ficha.vacia')}</p>
      </aside>
    );
  }
  const f = e.ficha;
  const version = f?.version ?? 'sin-ficha';
  // Un `rev(...)` nuevo también va en `camposDeFicha` (src/lib/prioridad.ts): esa lista alimenta el avance y "Marcar todo como correcto".
  const rev = (campo: string, idiomaCampo?: Idioma, etiqueta?: string) =>
    revisor ? (
      <ControlRevision
        key={`${claveRespuesta({ estructura: id, campo, idioma: idiomaCampo })}#${cargaRespuestas}`}
        entrada={id}
        campo={campo}
        idioma={idiomaCampo}
        version={version}
        etiqueta={etiqueta}
      />
    ) : null;
  const sinonimos = (['es', 'en'] as const).filter((i) => e.sinonimos[i].length);
  const padre = padreDeEntrada(id);
  const marcador = marcadorPorId(id);
  const rutasDeLaEntrada = rutas.filter((r) => r.entrada === id);
  const estadoIdioma = f?.revision[idioma]?.estado ?? 'borrador';
  // R9.2: la ficha dice que un docente la revisó y cuándo; nunca quién (ni su nombre ni su alias).
  const fechaIdioma = f?.revision[idioma]?.fecha ?? null;
  const estadoOtro = f?.revision[otro(idioma)]?.estado ?? 'borrador';
  const titulo = seleccion.pieza ? nombrePieza(seleccion.pieza, idioma, t) : nombre(e, idioma);
  const latin = latinVisible(e, t);

  const piezas = piezasDeEntrada(id);
  const color = piezas.length ? colorDePieza(piezas[0]!) : null;
  const fichaPadre = padre && estructuras[padre]?.ficha ? padre : null;

  return (
    <aside id="panel-ficha" ref={ficha} className="ficha" aria-labelledby="ficha-titulo" data-testid="ficha" data-entrada={id}>
      <header className="ficha-cabecera">
        <div className="ficha-titulos">
          {padre && (
            <p className="ficha-padre">
              {color && <span className="ficha-punto" style={{ background: color }} aria-hidden="true" />}
              <span className="solo-lector">{t('buscar.en', { lugar: '' })}</span>
              {nombreNodo(padre, idioma, t)}
            </p>
          )}
          <h2 id="ficha-titulo" ref={refTitulo} tabIndex={-1}>
            {titulo}
          </h2>
          {latin !== null && (
            <p className="ficha-latin">
              <span lang={latin === e.latin ? 'la' : undefined}>{latin}</span>
            </p>
          )}
          {e.sinonimos[idioma].length > 0 && (
            <p className="ficha-sinonimos" data-testid="sinonimos">
              {t('ficha.tambien', { nombres: e.sinonimos[idioma].join(', ') })}
            </p>
          )}
        </div>
        <button type="button" className="cerrar" aria-label={t('ficha.cerrar')} onClick={alCerrar}>
          ×
        </button>
      </header>
      {nombrePendiente(e, idioma) && <p className="etiqueta-aviso">{t('ficha.nombrePendiente')}</p>}
      {(piezasDeEntrada(id).some((p) => origenDe(p) === 'aproximada') || rutasDeLaEntrada.length > 0) && (
        <p className="etiqueta-aviso" data-testid="aviso-aproximada">
          {t('origen.aviso')}
        </p>
      )}
      {id === ENTRADA_VAGO && hayHuecos && (
        <p className="etiqueta-aviso" data-testid="aviso-hueco">
          {t('origen.huecoFicha')}
        </p>
      )}
      <div className="ficha-meta">
        {f && (
          <span className={`estado estado-${estadoIdioma}`} data-testid="estado-revision">
            {estadoIdioma === 'verificado' ? t('ficha.revisadoDocente') : t(`estado.${estadoIdioma}`)}
            {estadoIdioma === 'verificado' && fechaIdioma ? ` · ${fechaIdioma}` : ''}
          </span>
        )}
        <span className="ficha-fuente-nombre">
          {t('ficha.fuenteNombre')}: {e.fuente_nombre === PENDIENTE ? t('ficha.fuentePendiente') : e.fuente_nombre}
        </span>
      </div>
      <GruposDeLaEntrada id={id} idioma={idioma} />
      {revisor && vago && seleccion.malla && <RevisionTrazo malla={seleccion.malla} version={version} idioma={idioma} />}
      {revisor && f && <MarcarTodo key={`${id}|${idioma}`} id={id} idioma={idioma} version={version} />}
      {revisor && dudas[id] && (
        <section className="ficha-campo ficha-dudas" data-testid="dudas">
          <h3>{t('revision.dudasTitulo')}</h3>
          {dudas[id].map((d, i) => (
            <div key={d.id} className="ficha-duda">
              <p>{d.texto[idioma]}</p>
              {rev(`duda.${i}`)}
            </div>
          ))}
        </section>
      )}
      {revisor && (
        <div className="ficha-campo">
          <h3>{t('revision.nombres')}</h3>
          {rev('nombre', 'es', `${t('idioma.nombre_es')}: ${e.nombre.es}`)}
          {rev('nombre', 'en', `${t('idioma.nombre_en')}: ${e.nombre.en}`)}
          {rev('latin', undefined, `${t('ficha.latin')}: ${latin ?? '-'}`)}
          {sinonimos.map((i) => rev('sinonimos', i, `${t(`ficha.sinonimos_${i}`)}: ${e.sinonimos[i].join(', ')}`))}
          {piezas.length > 0 && (
            <>
              <h3>{t('revision.pieza')}</h3>
              {rev('pieza')}
            </>
          )}
        </div>
      )}
      <Acciones id={id} alCompartir={alCompartir} />

      {rutasDeLaEntrada.map((r) => (
        <section key={r.id} className="ficha-campo revision-ruta" data-testid={`ruta-${campoTrazado(r)}`}>
          <h3>{t('revision.trazadoTitulo', { nombre: r.nombre[idioma] })}</h3>
          <p className="recurso-nota">{t(`revision.trazadoEstado_${r.revision.estado}`)}</p>
          {revisor && vago && <p>{t('revision.trazadoAyuda')}</p>}
          {vago && rev(campoTrazado(r))}
        </section>
      ))}

      {marcador && (
        <section className="ficha-campo">
          <h3>{t('marcador.titulo')}</h3>
          <p>{t(`marcador.explica_${marcador.estado}`)}</p>
          {!revisor && marcador.fuente_ubicacion[idioma] && <p className="recurso-nota">{marcador.fuente_ubicacion[idioma]}</p>}
          {revisor && (
            <>
              {marcador.fuente_ubicacion[idioma] && (
                <div className="revision-control" data-testid="fuente-posicion">
                  <h4>{t('revision.fuentePosicion')}</h4>
                  <p>{marcador.fuente_ubicacion[idioma]}</p>
                </div>
              )}
              <PropuestaPosicion key={id} entrada={id} idioma={idioma} />
              {!yaPropuesta && (
                <>
                  {posicionConfirmable(marcador) && <PosicionCorrecta id={id} version={version} />}
                  <button type="button" className="boton-primario" onClick={() => useAtlas.getState().setUbicando(ubicando === id ? null : id)}>
                    {ubicando === id ? t('revision.cancelarUbicar') : t('revision.proponerPosicion')}
                  </button>
                  {ubicando === id && <p className="etiqueta-aviso">{t('revision.tocaElModelo')}</p>}
                </>
              )}
            </>
          )}
        </section>
      )}

      {!f ? (
        <section className="ficha-descripcion ficha-preparacion">
          <p className="en-preparacion">{t('ficha.enPreparacion')}</p>
          <p>{t('ficha.enPreparacionTexto')}</p>
          {fichaPadre && (
            <button
              type="button"
              className="enlace"
              onClick={() => window.dispatchEvent(new CustomEvent('atlas:elegir', { detail: { entrada: fichaPadre } }))}
            >
              {t('ficha.verFichaDe', { nombre: nombre(estructuras[fichaPadre]!, idioma) })}
            </button>
          )}
        </section>
      ) : (
        <>
          {estadoIdioma !== 'verificado' && estadoOtro === 'verificado' && (
            <p className="etiqueta-aviso">{t('ficha.verificadoOtroIdioma')}</p>
          )}
          <section className="ficha-descripcion" aria-label={t('ficha.descripcion')}>
            <Campo titulo={t('ficha.queEs')} revision={rev('que_es', idioma)}>
              <p className="ficha-lead">{f.que_es[idioma]}</p>
            </Campo>
            <Campo titulo={t('ficha.paraQueSirve')} revision={rev('para_que_sirve', idioma)}>
              <p>{f.para_que_sirve[idioma]}</p>
            </Campo>
            <Campo titulo={t('ficha.ubicacion')} revision={rev('ubicacion', idioma)}>
              <p>{f.ubicacion[idioma]}</p>
            </Campo>
          </section>
          {f.relaciones.length > 0 && (
            <Campo titulo={t('ficha.relaciones')} revision={rev('relaciones')}>
              <ul className="relaciones">
                {f.relaciones.map((r) =>
                  estructuras[r] ? (
                    <li key={r}>
                      <a
                        href={`#${r}`}
                        onClick={(ev) => {
                          ev.preventDefault();
                          window.dispatchEvent(new CustomEvent('atlas:elegir', { detail: { entrada: r } }));
                        }}
                      >
                        {nombre(estructuras[r], idioma)}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            </Campo>
          )}
          {f.relevancia.length > 0 && (
            <section className="ficha-campo">
              <h3>{t('ficha.relevancia')}</h3>
              <ul className="relevancia">
                {f.relevancia.map((a, i) => (
                  <li key={i}>
                    <span className={`evidencia evidencia-${a.evidencia}`}>{t(`evidencia.${a.evidencia}`)}</span>
                    <p>{a.texto[idioma]}</p>
                    <ListaFuentes fuentes={a.fuentes} />
                    {rev(`relevancia.${i}`, idioma)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="ficha-campo ficha-referencias">
        <h3>{t('ficha.referencias')}</h3>
        <Recursos propios={f?.recursos ?? []} heredados={recursosHeredados(id)} idioma={idioma} />
        <Articulos nombreEn={e.nombre.en} nombreEs={e.nombre.es} />
      </section>

      {f && (
        <details className="ficha-fuentes" open={!!revisor}>
          <summary>
            {t('ficha.fuentes')} ({f.fuentes.length})
          </summary>
          <ListaFuentes fuentes={f.fuentes} />
          {revisor && f.fuentes.map((_, i) => <div key={i}>{rev(`fuente.${i}`)}</div>)}
          <p className="ficha-version">
            {t('ficha.version')}: {f.version}
          </p>
        </details>
      )}

      {!revisor && (
        <footer className="ficha-pie" data-testid="ficha-pie">
          <ReportarError key={id} estructura={id} nombre={nombre(e, idioma)} idioma={idioma} version={version} />
        </footer>
      )}
    </aside>
  );
}
