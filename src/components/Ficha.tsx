// Ficha de pieza (F4), recursos (F9) y controles de revisión por campo (F24).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { esFragmentable, estructuras, origenDe, grupos, marcadorPorId, marcadores, nodos, padreDeEntrada, piezasDeEntrada, PENDIENTE } from '../data/atlas';
import type { Estructura, Fuente, Idioma, Recurso } from '../data/tipos';
import { latinVisible, nombre, nombreNodo, nombrePendiente, nombrePieza } from '../lib/nombres';
import { campoTrazado, rutaVisible } from '../lib/rutas';
import { enlacesArticulos } from '../lib/articulos';
import { accionAlPulsar, estadoAislar, estadoOcultar, estadoSeparar, propsPulsado, type Pulsado } from '../lib/alternar';
import { claveRespuesta, type Veredicto } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';
import { colorDePieza } from './colores';
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
      <aside id="panel-ficha" className="ficha ficha-vacia" aria-label={t('ficha.titulo')}>
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
  const rutasDeLaEntrada = rutas.filter((r) => r.entrada === id && rutaVisible(r, !!revisor));
  const estadoIdioma = f?.revision[idioma]?.estado ?? 'borrador';
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
      <div className="ficha-meta">
        {f && (
          <span className={`estado estado-${estadoIdioma}`}>
            {t(`estado.${estadoIdioma}`)}
            {f.revision[idioma]?.revisado_por ? ` · ${f.revision[idioma]!.revisado_por}, ${f.revision[idioma]!.fecha}` : ''}
          </span>
        )}
        <span className="ficha-fuente-nombre">
          {t('ficha.fuenteNombre')}: {e.fuente_nombre === PENDIENTE ? t('ficha.fuentePendiente') : e.fuente_nombre}
        </span>
      </div>
      <GruposDeLaEntrada id={id} idioma={idioma} />
      {revisor && (
        <div className="ficha-campo">
          <h3>{t('revision.nombres')}</h3>
          <p>
            {t('idioma.nombre_es')}: {e.nombre.es} · {t('idioma.nombre_en')}: {e.nombre.en} · {t('ficha.latin')}: {latin ?? '-'}
          </p>
          {rev('nombre', 'es')}
          {rev('nombre', 'en')}
          {rev('latin')}
          {piezas.length > 0 && (
            <>
              <h3>{t('revision.pieza')}</h3>
              {rev('pieza')}
            </>
          )}
        </div>
      )}
      <Acciones id={id} alCompartir={alCompartir} />

      {revisor && seleccion.malla && <RevisionTrazo malla={seleccion.malla} version={version} />}
      {revisor &&
        rutasDeLaEntrada.map((r) => (
          <section key={r.id} className="ficha-campo revision-ruta" data-testid={`revision-${campoTrazado(r)}`}>
            <h3>{t('revision.trazadoTitulo', { nombre: r.nombre[idioma] })}</h3>
            <p>{t('revision.trazadoAyuda')}</p>
            <p className="recurso-nota">{t(`revision.trazadoEstado_${r.revision.estado}`)}</p>
            {rev(campoTrazado(r))}
          </section>
        ))}

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
    </aside>
  );
}
