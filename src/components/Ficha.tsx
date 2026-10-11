// Ficha de pieza (F4), recursos (F9) y controles de revisión por campo (F24).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { estructuras, grupos, marcadorPorId, marcadores, nodos, padreDeEntrada, piezasDeEntrada, PENDIENTE } from '../data/atlas';
import type { Estructura, Fuente, Idioma, Recurso } from '../data/tipos';
import { nombre, nombreNodo, nombrePendiente, nombrePieza, nombreVisible } from '../lib/nombres';
import { accionAlPulsar, estadoAislar, estadoSeparar, propsPulsado, type Pulsado } from '../lib/alternar';
import { claveRespuesta, type Veredicto } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';
import { CONSULTA_MOVIL } from './useMovil';

const otro = (i: Idioma): Idioma => (i === 'es' ? 'en' : 'es');

function ControlRevision({ entrada, campo, idioma, version }: { entrada: string; campo: string; idioma?: Idioma; version: string }) {
  const { t } = useTranslation();
  const clave = claveRespuesta({ estructura: entrada, campo, idioma });
  const r = useAtlas((s) => s.respuestas[clave]);
  // El componente se monta con key={clave}: el texto nunca pasa de un campo o estructura a otro.
  const [texto, setTexto] = useState(r?.propuesta ?? '');
  const [comentario, setComentario] = useState(r?.comentario ?? '');
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
        <textarea
          aria-label={t('revision.propuesta')}
          placeholder={t('revision.propuestaAyuda')}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => responder('corregir', texto, comentario)}
          rows={3}
        />
      )}
      {r && (
        <textarea
          aria-label={t('revision.comentario')}
          placeholder={t('revision.comentario')}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          onBlur={() => responder(r.veredicto, r.veredicto === 'corregir' ? texto : undefined, comentario)}
          rows={2}
        />
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
      <a href={r.url} target="_blank" rel="noopener noreferrer">
        {r.titulo}
      </a>{' '}
      <span className="recurso-tipo">{t(`recurso.${r.tipo}`)}</span>
      {r.idioma !== idioma && <span className="etiqueta-aviso"> {t(`idioma.en_${r.idioma}`)}</span>}
      <div className="recurso-nota">{r.nota[idioma]}</div>
    </li>
  );
  if (!propios.length && !heredados.length) return null;
  return (
    <section className="ficha-campo">
      <h3>{t('ficha.recursos')}</h3>
      <label className="interruptor">
        <input type="checkbox" checked={soloMiIdioma} onChange={(e) => setSoloMiIdioma(e.target.checked)} />{' '}
        {t('ficha.soloMiIdioma')}
      </label>
      <ul className="recursos">{filtrar(propios).map(item)}</ul>
      {heredados.length > 0 && (
        <>
          <h4>{t('ficha.delGrupo')}</h4>
          <ul className="recursos">{filtrar(heredados).map(item)}</ul>
        </>
      )}
    </section>
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
  if (!piezas.length) {
    return (
      <div className="acciones">
        <button type="button" onClick={alCompartir}>
          {t('acciones.compartir')}
        </button>
      </div>
    );
  }
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
      <button
        type="button"
        {...propsPulsado(separado)}
        onClick={() => (accionAlPulsar(separado) === 'desactivar' ? s().devolver(piezas) : s().separar(piezas))}
      >
        {t('acciones.separar')}
      </button>
      <button type="button" onClick={() => s().alternarVisibles(piezas, false)}>
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

function RevisionTrazo({ malla, version }: { malla: string; version: string }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language as Idioma;
  const campo = `trazo:${malla}`;
  const clave = claveRespuesta({ estructura: 'vagus-nerve-x', campo });
  const r = useAtlas((s) => s.respuestas[clave]);
  const ramos = marcadores.filter((m) => m.padre === 'g-vagus-nerve-x' && m.id !== 'm-jugular-foramen');
  const lado = malla.includes('.l#') ? t('lado.izquierdo') : t('lado.derecho');
  const num = /#t(\d+)/.exec(malla)?.[1] ?? '?';
  return (
    <section className="ficha-campo revision-trazo" data-testid="revision-trazo">
      <h3>{t('revision.trazoTitulo', { numero: num, lado })}</h3>
      <p>{t('revision.trazoAyuda')}</p>
      <select
        aria-label={t('revision.trazoPregunta')}
        value={r?.ramo ?? ''}
        onChange={(e) =>
          useAtlas.getState().responder({
            estructura: 'vagus-nerve-x',
            campo,
            veredicto: 'corregir',
            malla,
            ramo: e.target.value,
            version,
            fecha: new Date().toISOString(),
          })
        }
      >
        <option value="" disabled>
          {t('revision.trazoPregunta')}
        </option>
        {ramos.map((m) => (
          <option key={m.id} value={m.id}>
            {nombre(estructuras[m.id], idioma)}
          </option>
        ))}
        <option value="no_es_ramo">{t('revision.noEsRamo')}</option>
        <option value="no_se">{t('revision.noSe')}</option>
      </select>
    </section>
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
    <p className="ficha-padre">
      {t('ficha.gruposDeEstudio')}: {lista.map((g) => g.nombre[idioma]).join(', ')}
    </p>
  );
}

export default function Ficha({ idioma, alCompartir, alCerrar }: { idioma: Idioma; alCompartir: () => void; alCerrar: () => void }) {
  const { t } = useTranslation();
  const seleccion = useAtlas((s) => s.seleccion);
  const ambos = useAtlas((s) => s.ambos);
  const revisor = useAtlas((s) => s.revisor);
  const ubicando = useAtlas((s) => s.ubicando);
  const enfocar = useAtlas((s) => s.enfocarFicha);
  const id = seleccion.entrada;
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
      <aside className="ficha ficha-vacia" aria-label={t('ficha.titulo')}>
        <p>{t('ficha.vacia')}</p>
      </aside>
    );
  }
  const f = e.ficha;
  const version = f?.version ?? 'sin-ficha';
  const rev = (campo: string, idiomaCampo?: Idioma) =>
    revisor ? (
      <ControlRevision
        key={claveRespuesta({ estructura: id, campo, idioma: idiomaCampo })}
        entrada={id}
        campo={campo}
        idioma={idiomaCampo}
        version={version}
      />
    ) : null;
  const padre = padreDeEntrada(id);
  const marcador = marcadorPorId(id);
  const estadoIdioma = f?.revision[idioma]?.estado ?? 'borrador';
  const estadoOtro = f?.revision[otro(idioma)]?.estado ?? 'borrador';
  const titulo = seleccion.pieza ? nombrePieza(seleccion.pieza, idioma, ambos, t) : nombreVisible(e, idioma, ambos);

  return (
    <aside ref={ficha} className="ficha" aria-labelledby="ficha-titulo" data-testid="ficha" data-entrada={id}>
      <header className="ficha-cabecera">
        <h2 id="ficha-titulo" ref={refTitulo} tabIndex={-1}>
          {titulo}
        </h2>
        <button type="button" className="cerrar" aria-label={t('ficha.cerrar')} onClick={alCerrar}>
          ×
        </button>
      </header>
      <p className="ficha-latin">
        <span lang="la">{e.latin && e.latin !== PENDIENTE ? e.latin : t('ficha.latinPendiente')}</span>
      </p>
      {ambos && <p className="ficha-otro">{t(`idioma.nombre_${otro(idioma)}`)}: {nombre(e, otro(idioma))}</p>}
      {nombrePendiente(e, idioma) && <p className="etiqueta-aviso">{t('ficha.nombrePendiente')}</p>}
      {padre && <p className="ficha-padre">{t('buscar.en', { lugar: nombreNodo(padre, idioma, false, t) })}</p>}
      <p className="ficha-fuente-nombre">
        {t('ficha.fuenteNombre')}: {e.fuente_nombre === PENDIENTE ? t('ficha.fuentePendiente') : e.fuente_nombre}
      </p>
      <GruposDeLaEntrada id={id} idioma={idioma} />
      {revisor && (
        <div className="ficha-campo">
          <h3>{t('revision.nombres')}</h3>
          <p>
            {t('idioma.nombre_es')}: {e.nombre.es} · {t('idioma.nombre_en')}: {e.nombre.en} · {t('ficha.latin')}: {e.latin}
          </p>
          {rev('nombre', 'es')}
          {rev('nombre', 'en')}
          {rev('latin')}
          {piezasDeEntrada(id).length > 0 && (
            <>
              <h3>{t('revision.pieza')}</h3>
              {rev('pieza')}
            </>
          )}
        </div>
      )}
      <Acciones id={id} alCompartir={alCompartir} />

      {revisor && seleccion.malla && <RevisionTrazo malla={seleccion.malla} version={version} />}

      {marcador && (
        <section className="ficha-campo">
          <h3>{t('marcador.titulo')}</h3>
          <p>{t(`marcador.explica_${marcador.estado}`)}</p>
          {marcador.fuente_ubicacion[idioma] && <p className="recurso-nota">{marcador.fuente_ubicacion[idioma]}</p>}
          {revisor && (
            <>
              <button type="button" className="boton-primario" onClick={() => useAtlas.getState().setUbicando(ubicando === id ? null : id)}>
                {ubicando === id ? t('revision.cancelarUbicar') : t('revision.proponerPosicion')}
              </button>
              {ubicando === id && <p className="etiqueta-aviso">{t('revision.tocaElModelo')}</p>}
            </>
          )}
        </section>
      )}

      {!f ? (
        <p className="en-preparacion">{t('ficha.enPreparacion')}</p>
      ) : (
        <>
          <p className={`estado estado-${estadoIdioma}`}>
            {t(`estado.${estadoIdioma}`)}
            {f.revision[idioma]?.revisado_por ? ` · ${f.revision[idioma]!.revisado_por}, ${f.revision[idioma]!.fecha}` : ''}
          </p>
          {estadoIdioma !== 'verificado' && estadoOtro === 'verificado' && (
            <p className="etiqueta-aviso">{t('ficha.verificadoOtroIdioma')}</p>
          )}
          <Campo titulo={t('ficha.ubicacion')} revision={rev('ubicacion', idioma)}>
            <p>{f.ubicacion[idioma]}</p>
          </Campo>
          <Campo titulo={t('ficha.queEs')} revision={rev('que_es', idioma)}>
            <p>{f.que_es[idioma]}</p>
          </Campo>
          <Campo titulo={t('ficha.paraQueSirve')} revision={rev('para_que_sirve', idioma)}>
            <p>{f.para_que_sirve[idioma]}</p>
          </Campo>
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
                        {nombreVisible(estructuras[r], idioma, ambos)}
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
                    <p>{a.texto[idioma]}</p>
                    <p>
                      <span className={`evidencia evidencia-${a.evidencia}`}>{t(`evidencia.${a.evidencia}`)}</span>
                    </p>
                    <ListaFuentes fuentes={a.fuentes} />
                    {rev(`relevancia.${i}`, idioma)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Recursos propios={f.recursos} heredados={recursosHeredados(id)} idioma={idioma} />
          <section className="ficha-campo">
            <h3>{t('ficha.fuentes')}</h3>
            <ListaFuentes fuentes={f.fuentes} />
            {revisor && f.fuentes.map((_, i) => <div key={i}>{rev(`fuente.${i}`)}</div>)}
          </section>
          <p className="ficha-version">
            {t('ficha.version')}: {f.version}
          </p>
        </>
      )}
      {!f && <Recursos propios={[]} heredados={recursosHeredados(id)} idioma={idioma} />}
    </aside>
  );
}
