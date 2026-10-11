// Modo revisión docente (F24): avance, fichas pendientes y envío por formulario de Google.
import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre } from '../lib/nombres';
import { cargaRevision, desactualizadas, formularioConfigurado, urlsFormulario, type Respuesta } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';

const claveIdb = (codigo: string) => `revision:${codigo}`;
const versionActual = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
const conFicha = Object.values(estructuras).filter((e) => e.ficha);

export default function PanelRevision({ idioma, alElegir }: { idioma: Idioma; alElegir: (id: string) => void }) {
  const { t } = useTranslation();
  const revisor = useAtlas((s) => s.revisor);
  const respuestas = useAtlas((s) => s.respuestas);
  const [abierto, setAbierto] = useState(false);
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

  if (!revisor) return null;
  const lista = Object.values(respuestas);
  const viejas = desactualizadas(lista, versionActual);
  const pendientes = conFicha.filter((e) => !porEstructura.has(e.id));
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
      <button type="button" className="boton-primario" onClick={() => setAbierto(!abierto)}>
        {t('revision.enviar')}
      </button>
      {viejas.length > 0 && <span className="etiqueta-aviso">{t('revision.desactualizadas', { count: viejas.length })}</span>}
      {abierto && (
        <div className="dialogo-revision" role="dialog" aria-label={t('revision.enviar')}>
          <p>{t('revision.consentimiento')}</p>
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
          <h3>{t('revision.pendientes')}</h3>
          {pendientes.length ? (
            <ul>
              {pendientes.map((e) => (
                <li key={e.id}>
                  <button type="button" className="enlace" onClick={() => alElegir(e.id)}>
                    {nombre(e, idioma)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('revision.sinPendientes')}</p>
          )}
          <button type="button" onClick={() => setAbierto(false)}>
            {t('comun.cerrar')}
          </button>
        </div>
      )}
    </div>
  );
}
