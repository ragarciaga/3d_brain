// Modo revisión docente (F24): avance, fichas pendientes y envío por formulario de Google.
import { get, set } from 'idb-keyval';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre, nombrePendiente } from '../lib/nombres';
import { ordenDeRevision } from '../lib/prioridad';
import { cargaRevision, desactualizadas, formularioConfigurado, separarIncompletas, urlsFormulario, type Respuesta } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';

const claveIdb = (codigo: string) => `revision:${codigo}`;
const versionActual = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
const claveGuia = (codigo: string) => `atlas:guia-vista:${codigo}`;
type Vista = 'que' | 'como' | 'enviar' | null;
const ID_TITULO = 'dialogo-revision-titulo'; // solo hay un diálogo abierto a la vez

function guiaVista(codigo: string): boolean {
  try {
    return localStorage.getItem(claveGuia(codigo)) === '1';
  } catch {
    return true; // sin almacenamiento no se insiste: la guía queda a un toque
  }
}

function marcarGuiaVista(codigo: string) {
  try {
    localStorage.setItem(claveGuia(codigo), '1');
  } catch {
    /* nada que guardar */
  }
}

export default function PanelRevision({ idioma, alElegir }: { idioma: Idioma; alElegir: (id: string) => void }) {
  const { t } = useTranslation();
  const revisor = useAtlas((s) => s.revisor);
  const respuestas = useAtlas((s) => s.respuestas);
  const [elegida, setElegida] = useState<Vista | 'ninguna'>(null);
  const rutas = useAtlas((s) => s.rutas);
  const [enviadas, setEnviadas] = useState<Record<string, string>>({});
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [partes, setPartes] = useState<{ id: string; urls: string[] } | null>(null);

  useEffect(() => {
    if (!revisor) return;
    let vigente = true;
    get(claveIdb(revisor))
      .then((guardado: { respuestas?: Record<string, Respuesta>; enviadas?: Record<string, string> } | undefined) => {
        if (!vigente) return;
        useAtlas.getState().cargarRespuestas(guardado?.respuestas ?? {});
        setEnviadas(guardado?.enviadas ?? {});
      })
      .catch(() => undefined)
      .finally(() => vigente && setCargadoDe(revisor));
    return () => {
      vigente = false;
    };
  }, [revisor]);

  useEffect(() => {
    if (!revisor || cargadoDe !== revisor) return;
    set(claveIdb(revisor), { respuestas, enviadas }).catch(() => undefined);
  }, [revisor, respuestas, enviadas, cargadoDe]);

  const porEstructura = useMemo(() => {
    const m = new Map<string, Respuesta[]>();
    for (const r of Object.values(respuestas)) m.set(r.estructura, [...(m.get(r.estructura) ?? []), r]);
    return m;
  }, [respuestas]);

  // La primera vez que un docente entra con su código, la guía se abre sola.
  const vista: Vista = !revisor ? null : elegida === 'ninguna' ? null : (elegida ?? (guiaVista(revisor) ? null : 'como'));
  const titulo = useRef<HTMLHeadingElement>(null);
  const botones = useRef<Partial<Record<'que' | 'como' | 'enviar', HTMLButtonElement | null>>>({});

  // Al abrir un diálogo, el foco va a su título: así se anuncia y Escape queda a un toque.
  useEffect(() => {
    if (vista) titulo.current?.focus({ preventScroll: true });
  }, [vista]);

  // Escape (Pagina) cierra el diálogo antes que cualquier otra cosa.
  useEffect(() => {
    useAtlas.getState().setDialogoRevision(vista !== null);
    return () => useAtlas.getState().setDialogoRevision(false);
  }, [vista]);

  const cerrar = useCallback(
    (devolverFoco: boolean) => {
      if (!revisor) return;
      if (vista === 'como') marcarGuiaVista(revisor);
      setElegida('ninguna');
      // El botón de la barra ya está en pantalla: se enfoca antes de que el diálogo se desmonte.
      if (devolverFoco && vista) botones.current[vista]?.focus();
    },
    [revisor, vista],
  );

  useEffect(() => {
    const alCerrar = () => cerrar(true);
    window.addEventListener('atlas:cerrar-revision', alCerrar);
    return () => window.removeEventListener('atlas:cerrar-revision', alCerrar);
  }, [cerrar]);

  if (!revisor) return null;
  const abrir = (v: Vista) => {
    if (vista === 'como' || v === 'como') marcarGuiaVista(revisor);
    setElegida(v ?? 'ninguna');
  };
  const lista = Object.values(respuestas);
  const viejas = desactualizadas(lista, versionActual);
  const secciones = ordenDeRevision(new Set(porEstructura.keys()), rutas.map((r) => r.entrada));
  const totalPendientes = secciones.reduce((n, x) => n + x.ids.length, 0);
  const alternar = (v: Vista) => abrir(vista === v ? null : v);
  const configurado = formularioConfigurado(configRevision);

  const copiarODescargar = async (id: string, l: Respuesta[]) => {
    const carga = cargaRevision(revisor, id, l);
    try {
      await navigator.clipboard.writeText(carga);
      setAviso(t('revision.copiada'));
    } catch {
      const url = URL.createObjectURL(new Blob([carga], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `revision-${revisor}-${id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso(t('revision.descargada'));
    }
  };

  const enviar = async (id: string, l: Respuesta[]) => {
    const urls = urlsFormulario(configRevision, revisor, id, l);
    if (urls.length === 1) window.open(urls[0], '_blank', 'noopener');
    else if (urls.length > 1) setPartes({ id, urls });
    else await copiarODescargar(id, l);
    setEnviadas({ ...enviadas, [id]: new Date().toISOString() });
  };

  return (
    <div className="panel-revision" role="region" aria-label={t('revision.titulo')} data-testid="panel-revision">
      <span>
        <strong>{t('revision.titulo')}</strong> · {t('revision.codigo', { codigo: revisor })} ·{' '}
        <span data-testid="total-respuestas">{t('revision.respuestas', { count: lista.length })}</span>
      </span>
      <button type="button" ref={(el) => { botones.current.que = el; }} aria-expanded={vista === 'que'} onClick={() => alternar('que')}>
        {t('revision.queRevisar', { count: totalPendientes })}
      </button>
      <button type="button" ref={(el) => { botones.current.como = el; }} aria-expanded={vista === 'como'} onClick={() => alternar('como')}>
        {t('revision.comoRevisar')}
      </button>
      <button
        type="button"
        ref={(el) => { botones.current.enviar = el; }}
        className="boton-primario"
        aria-expanded={vista === 'enviar'}
        onClick={() => alternar('enviar')}
      >
        {t('revision.enviar')}
      </button>
      {viejas.length > 0 && <span className="etiqueta-aviso">{t('revision.desactualizadas', { count: viejas.length })}</span>}
      {vista === 'que' && (
        <div className="dialogo-revision" role="dialog" aria-labelledby={ID_TITULO} data-testid="que-revisar">
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.queRevisarTitulo')}
          </h2>
          <p>{t('revision.queAyuda')}</p>
          {secciones.length ? (
            secciones.map((sec, i) => (
              <details key={sec.seccion} open={i === 0} className="seccion-revision" data-seccion={sec.seccion}>
                <summary>
                  {t(`revision.seccion_${sec.seccion}`)} ({sec.ids.length})
                </summary>
                <ul>
                  {sec.ids.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="enlace"
                        onClick={() => {
                          alElegir(id);
                          abrir(null); // el foco ya va al título de la ficha: no se devuelve a la barra
                        }}
                      >
                        {nombre(estructuras[id], idioma) || id}
                      </button>
                      {nombrePendiente(estructuras[id], idioma) && <span className="etiqueta-aviso"> {t('revision.nombrePendiente')}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            ))
          ) : (
            <p>{t('revision.sinPendientes')}</p>
          )}
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
      {vista === 'como' && (
        <div className="dialogo-revision guia-revision" role="dialog" aria-labelledby={ID_TITULO} data-testid="como-revisar">
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.comoRevisar')}
          </h2>
          {(['intro', 'responder', 'idiomas', 'dudas', 'nombres', 'marcadores', 'trazos', 'recorridos', 'enviar', 'privacidad'] as const).map((k) => (
            <p key={k}>{t(`revision.guia.${k}`)}</p>
          ))}
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer" className="boton-primario enlace-boton">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
      {vista === 'enviar' && (
        <div className="dialogo-revision" role="dialog" aria-labelledby={ID_TITULO}>
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.enviar')}
          </h2>
          <p>{t('revision.consentimiento')}</p>
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          {!configurado && <p className="etiqueta-aviso">{t('revision.sinFormulario')}</p>}
          <ul>
            {[...porEstructura.entries()].map(([id, l]) => {
              const { completas, incompletas } = separarIncompletas(l);
              return (
                <li key={id}>
                  {nombre(estructuras[id], idioma) || id} · {t('revision.respuestas', { count: completas.length })}
                  {incompletas > 0 && (
                    <span className="etiqueta-aviso" data-testid="incompletas">
                      {' '}
                      {t('revision.incompletasNoSeEnvian', { count: incompletas })}
                    </span>
                  )}
                  {enviadas[id] && <span className="etiqueta-aviso"> {t('revision.enviadaEl', { fecha: enviadas[id]!.slice(0, 10) })}</span>}{' '}
                  <button type="button" disabled={completas.length === 0} onClick={() => void enviar(id, completas)}>
                    {configurado ? t('revision.abrirFormulario') : t('revision.copiar')}
                  </button>
                </li>
              );
            })}
          </ul>
          {partes && (
            <div role="group" aria-label={t('revision.largaExplica')}>
              <p>{t('revision.largaExplica')}</p>
              {partes.urls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="enlace-parte">
                  {t('revision.parte', { n: i + 1, total: partes.urls.length })}
                </a>
              ))}
            </div>
          )}
          {aviso && <p role="status">{aviso}</p>}
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
