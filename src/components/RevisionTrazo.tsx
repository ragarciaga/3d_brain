// Panel del trazo del vago (F24): qué ramo es la malla seleccionada, con la propuesta de la auditoría
// del modelo (cuando es una sola opción de la lista) y su confianza, evidencia y fuente, un comentario
// opcional y "Siguiente trazo".
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre } from '../lib/nombres';
import { ESPERA_GUARDADO_MS } from '../lib/revision';
import { auditoriaDeTrazo, avanceTrazos, claveTrazo, ENTRADA_VAGO, propuestaDeTrazo, ramosDeTrazo, siguienteTrazo } from '../lib/trazos';
import { useAtlas } from '../store/useAtlas';
import { irATrazo } from './irATrazo';

/** Comentario opcional de un trazo ya respondido. Se monta con key: el texto no pasa de un trazo a otro. */
function ComentarioTrazo({ clave }: { clave: string }) {
  const { t } = useTranslation();
  const r = useAtlas((s) => s.respuestas[clave]);
  const [texto, setTexto] = useState(r?.comentario ?? '');
  const id = useId();

  const guardar = () => {
    const actual = useAtlas.getState().respuestas[clave];
    if (!actual || (texto || undefined) === actual.comentario) return;
    useAtlas.getState().responder({ ...actual, comentario: texto || undefined, fecha: new Date().toISOString() });
  };

  // Lo que se escribe se guarda tras una pausa, sin esperar a que el docente salga del campo.
  useEffect(() => {
    if (!r || (texto || undefined) === r.comentario) return;
    const espera = setTimeout(() => {
      useAtlas.getState().responder({ ...r, comentario: texto || undefined, fecha: new Date().toISOString() });
    }, ESPERA_GUARDADO_MS);
    return () => clearTimeout(espera);
  }, [r, texto]);

  return (
    <>
      <label htmlFor={id}>{t('revision.comentario')}</label>
      <textarea
        id={id}
        rows={2}
        maxLength={4000} // el mismo tope que valida el importador (scripts/lib/revisiones.ts); si no, el envío se descarta
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
      />
    </>
  );
}

export default function RevisionTrazo({ malla, version, idioma }: { malla: string; version: string; idioma: Idioma }) {
  const { t } = useTranslation();
  const idSelect = useId();
  const campo = `trazo:${malla}`;
  const clave = claveTrazo(malla);
  const r = useAtlas((s) => s.respuestas[clave]);
  const respuestas = useAtlas((s) => s.respuestas);
  const trazos = useAtlas((s) => s.trazos);
  const cargaRespuestas = useAtlas((s) => s.cargaRespuestas);
  const propuesta = propuestaDeTrazo(malla);
  const auditoria = auditoriaDeTrazo(malla);
  const { pendientes, total } = avanceTrazos(trazos, respuestas);
  const siguiente = siguienteTrazo(trazos, respuestas, malla);
  const lado = malla.includes('.l#') ? t('lado.izquierdo') : t('lado.derecho');
  const num = /#t(\d+)/.exec(malla)?.[1] ?? '?';
  const activo = propuesta !== null && r?.veredicto === 'correcto' && r.ramo === propuesta;

  const responder = (ramo: string, veredicto: 'correcto' | 'corregir') =>
    useAtlas.getState().responder({
      estructura: ENTRADA_VAGO,
      campo,
      veredicto,
      malla,
      ramo,
      comentario: r?.comentario,
      version,
      fecha: new Date().toISOString(),
    });

  return (
    <section className="ficha-campo revision-trazo" data-testid="revision-trazo">
      <h3>{t('revision.trazoTitulo', { numero: num, lado })}</h3>
      <p>{t('revision.trazoAyuda')}</p>
      <p data-testid="trazos-pendientes">{t('revision.trazosPorRevisar', { pendientes, total })}</p>
      {propuesta !== null && (
        <p>{t('revision.trazoPropuesta', { nombre: propuesta === 'no_es_ramo' ? t('revision.noEsRamo') : nombre(estructuras[propuesta], idioma) })}</p>
      )}
      {propuesta !== null && auditoria?.confianza && (
        <p className="recurso-nota" data-testid="trazo-confianza">
          {t('revision.trazoConfianza', { nivel: t(`revision.confianza_${auditoria.confianza}`) })}
        </p>
      )}
      {propuesta === null && (
        <p className="recurso-nota" data-testid="trazo-sin-propuesta">
          {t('revision.trazoSinPropuesta')}
        </p>
      )}
      {auditoria?.evidencia && (
        <p className="recurso-nota" data-testid="trazo-evidencia">
          {auditoria.evidencia[idioma]}
        </p>
      )}
      {auditoria?.fuente && (
        <p className="recurso-nota" data-testid="trazo-fuente">
          {t('revision.trazoFuente', { fuente: auditoria.fuente })}
        </p>
      )}
      <label htmlFor={idSelect}>{t('revision.trazoPregunta')}</label>
      <select id={idSelect} value={r?.ramo ?? ''} onChange={(e) => responder(e.target.value, e.target.value === propuesta ? 'correcto' : 'corregir')}>
        <option value="" disabled>
          {t('revision.trazoPregunta')}
        </option>
        {ramosDeTrazo().map((id) => (
          <option key={id} value={id}>
            {nombre(estructuras[id], idioma)}
          </option>
        ))}
        <option value="no_es_ramo">{t('revision.noEsRamo')}</option>
        <option value="no_se">{t('revision.noSe')}</option>
      </select>
      {r && <ComentarioTrazo key={`${clave}#${cargaRespuestas}`} clave={clave} />}
      <div className="revision-botones">
        {propuesta !== null && (
          <button
            type="button"
            className={`chip chip-correcto${activo ? ' activo' : ''}`}
            aria-pressed={activo}
            onClick={() => (activo ? useAtlas.getState().borrarRespuesta(clave) : responder(propuesta, 'correcto'))}
          >
            {t('revision.trazoCorrecto')}
          </button>
        )}
        <button type="button" data-testid="siguiente-trazo" disabled={siguiente === null} onClick={() => siguiente && irATrazo(siguiente, { enfocar: false })}>
          {t('revision.trazoSiguiente')}
        </button>
      </div>
    </section>
  );
}
