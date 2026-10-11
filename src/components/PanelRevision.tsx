// Modo revisión docente (F24): barra con el avance y envío por formulario de Google.
import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre } from '../lib/nombres';
import { cargaRevision, formularioConfigurado, urlFormulario, type Respuesta } from '../lib/revision';
import { useAtlas } from '../store/useAtlas';

const claveIdb = (codigo: string) => `revision:${codigo}`;

export default function PanelRevision({ idioma }: { idioma: Idioma }) {
  const { t } = useTranslation();
  const revisor = useAtlas((s) => s.revisor);
  const respuestas = useAtlas((s) => s.respuestas);
  const [abierto, setAbierto] = useState(false);
  const [enviadas, setEnviadas] = useState<Record<string, string>>({});
  const [cargado, setCargado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!revisor) return;
    get(claveIdb(revisor))
      .then((guardado: { respuestas?: Record<string, Respuesta>; enviadas?: Record<string, string> } | undefined) => {
        if (guardado?.respuestas) useAtlas.getState().cargarRespuestas(guardado.respuestas);
        if (guardado?.enviadas) setEnviadas(guardado.enviadas);
      })
      .catch(() => undefined)
      .finally(() => setCargado(true));
  }, [revisor]);

  useEffect(() => {
    if (!revisor || !cargado) return;
    set(claveIdb(revisor), { respuestas, enviadas }).catch(() => undefined);
  }, [revisor, respuestas, enviadas, cargado]);

  const porEstructura = useMemo(() => {
    const m = new Map<string, Respuesta[]>();
    for (const r of Object.values(respuestas)) {
      const l = m.get(r.estructura) ?? [];
      l.push(r);
      m.set(r.estructura, l);
    }
    return m;
  }, [respuestas]);

  if (!revisor) return null;
  const total = Object.keys(respuestas).length;
  const configurado = formularioConfigurado(configRevision);

  const enviar = async (estructura: string, lista: Respuesta[]) => {
    const url = urlFormulario(configRevision, revisor, estructura, lista);
    if (url) {
      window.open(url, '_blank', 'noopener');
    } else {
      const carga = cargaRevision(revisor, estructura, lista);
      try {
        await navigator.clipboard.writeText(carga);
        setAviso(t('revision.copiada'));
      } catch {
        const blob = new Blob([carga], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `revision-${revisor}-${estructura}.json`;
        a.click();
        setAviso(t('revision.descargada'));
      }
    }
    setEnviadas({ ...enviadas, [estructura]: new Date().toISOString() });
  };

  return (
    <div className="panel-revision" role="region" aria-label={t('revision.titulo')} data-testid="panel-revision">
      <span>
        <strong>{t('revision.titulo')}</strong> · {t('revision.codigo', { codigo: revisor })} ·{' '}
        <span data-testid="total-respuestas">{t('revision.respuestas', { count: total })}</span>
      </span>
      <button type="button" className="boton-primario" onClick={() => setAbierto(!abierto)} disabled={!total}>
        {t('revision.enviar')}
      </button>
      {abierto && (
        <div className="dialogo-revision" role="dialog" aria-label={t('revision.enviar')}>
          <p>{t('revision.consentimiento')}</p>
          {!configurado && <p className="etiqueta-aviso">{t('revision.sinFormulario')}</p>}
          <ul>
            {[...porEstructura.entries()].map(([id, lista]) => (
              <li key={id}>
                {nombre(estructuras[id], idioma) || id} · {t('revision.respuestas', { count: lista.length })}
                {enviadas[id] && <span className="etiqueta-aviso"> {t('revision.enviadaEl', { fecha: enviadas[id]!.slice(0, 10) })}</span>}{' '}
                <button type="button" onClick={() => void enviar(id, lista)}>
                  {configurado ? t('revision.abrirFormulario') : t('revision.copiar')}
                </button>
              </li>
            ))}
          </ul>
          {aviso && <p role="status">{aviso}</p>}
          <button type="button" onClick={() => setAbierto(false)}>
            {t('comun.cerrar')}
          </button>
        </div>
      )}
    </div>
  );
}
