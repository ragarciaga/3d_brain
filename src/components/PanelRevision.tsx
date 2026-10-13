// Modo revisión docente (F24): avance, fichas pendientes y envío por formulario de Google.
import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre, nombrePendiente } from '../lib/nombres';
import { avanceDeFicha, avanceGlobal, ordenDeRevision } from '../lib/prioridad';
import { cargaRevision, desactualizadas, formularioConfigurado, urlsFormulario, type Respuesta } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';

const claveIdb = (codigo: string) => `revision:${codigo}`;
const versionActual = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
const claveGuia = (codigo: string) => `atlas:guia-vista:${codigo}`;
type Vista = 'que' | 'como' | 'enviar' | null;

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

  const respondidas = useMemo(() => new Set(Object.keys(respuestas)), [respuestas]);

  if (!revisor) return null;
  // La primera vez que un docente entra con su código, la guía se abre sola.
  const vista: Vista = elegida === 'ninguna' ? null : (elegida ?? (guiaVista(revisor) ? null : 'como'));
  const setVista = (v: Vista) => {
    if (vista === 'como' || v === 'como') marcarGuiaVista(revisor);
    setElegida(v ?? 'ninguna');
  };
  const lista = Object.values(respuestas);
  const viejas = desactualizadas(lista, versionActual);
  const secciones = ordenDeRevision(respondidas, idioma, rutas);
  const global = avanceGlobal(respondidas, idioma, rutas);
  const totalPendientes = secciones.reduce((n, x) => n + x.ids.length, 0);
  const alternar = (v: Vista) => setVista(vista === v ? null : v);
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
        <span data-testid="total-respuestas">{t('revision.respuestas', { count: lista.length })}</span> ·{' '}
        <span data-testid="avance-global">{t('revision.avanceGlobal', { completas: global.completas, total: global.total })}</span>
      </span>
      <button type="button" aria-expanded={vista === 'que'} onClick={() => alternar('que')}>
        {t('revision.queRevisar', { count: totalPendientes })}
      </button>
      <button type="button" aria-expanded={vista === 'como'} onClick={() => alternar('como')}>
        {t('revision.comoRevisar')}
      </button>
      <button type="button" className="boton-primario" aria-expanded={vista === 'enviar'} onClick={() => alternar('enviar')}>
        {t('revision.enviar')}
      </button>
      {viejas.length > 0 && <span className="etiqueta-aviso">{t('revision.desactualizadas', { count: viejas.length })}</span>}
      {vista === 'que' && (
        <div className="dialogo-revision" role="dialog" aria-label={t('revision.queRevisarTitulo')} data-testid="que-revisar">
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
                          setVista(null);
                        }}
                      >
                        {nombre(estructuras[id], idioma) || id}
                      </button>
                      {nombrePendiente(estructuras[id], idioma) && <span className="etiqueta-aviso"> {t('revision.nombrePendiente')}</span>}
                      <span className="recurso-nota" data-testid="avance-ficha">
                        {' '}
                        · {t('revision.avanceFicha', avanceDeFicha(id, respondidas, idioma, rutas))}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))
          ) : (
            <p>{t('revision.sinPendientes')}</p>
          )}
          <button type="button" onClick={() => setVista(null)}>
            {t('comun.cerrar')}
          </button>
        </div>
      )}
      {vista === 'como' && (
        <div className="dialogo-revision guia-revision" role="dialog" aria-label={t('revision.comoRevisar')} data-testid="como-revisar">
          {(['intro', 'responder', 'idiomas', 'dudas', 'nombres', 'marcadores', 'trazos', 'recorridos', 'enviar', 'privacidad'] as const).map((k) => (
            <p key={k}>{t(`revision.guia.${k}`)}</p>
          ))}
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer" className="boton-primario enlace-boton">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          <button type="button" onClick={() => setVista(null)}>
            {t('comun.cerrar')}
          </button>
        </div>
      )}
      {vista === 'enviar' && (
        <div className="dialogo-revision" role="dialog" aria-label={t('revision.enviar')}>
          <p>{t('revision.consentimiento')}</p>
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          {!configurado && <p className="etiqueta-aviso">{t('revision.sinFormulario')}</p>}
          <ul>
            {[...porEstructura.entries()].map(([id, l]) => (
              <li key={id}>
                {nombre(estructuras[id], idioma) || id} · {t('revision.respuestas', { count: l.length })}
                {enviadas[id] && <span className="etiqueta-aviso"> {t('revision.enviadaEl', { fecha: enviadas[id]!.slice(0, 10) })}</span>}{' '}
                <button type="button" onClick={() => void enviar(id, l)}>
                  {configurado ? t('revision.abrirFormulario') : t('revision.copiar')}
                </button>
              </li>
            ))}
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
          <button type="button" onClick={() => setVista(null)}>
            {t('comun.cerrar')}
          </button>
        </div>
      )}
    </div>
  );
}
