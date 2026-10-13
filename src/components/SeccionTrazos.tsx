// Sección "Trazos del vago" de "Qué revisar" (F24). Los trazos no son fichas: no entran en la lista de
// fichas pendientes ni en su contador. Sin encabezados ni `li`: el diálogo tiene un solo encabezado.
import { useTranslation } from 'react-i18next';
import { avanceTrazos, trazosPendientes } from '../lib/trazos';
import { useAtlas } from '../store/useAtlas';
import { irATrazo } from './irATrazo';

export default function SeccionTrazos({ alAbrir }: { alAbrir: () => void }) {
  const { t } = useTranslation();
  const trazos = useAtlas((s) => s.trazos);
  const respuestas = useAtlas((s) => s.respuestas);
  if (trazos.length === 0) return null; // el modelo aún no carga
  const { pendientes, total } = avanceTrazos(trazos, respuestas);
  return (
    <details className="seccion-revision" data-seccion="trazos">
      <summary>{t('revision.trazosSeccion', { pendientes, total })}</summary>
      <p>{t('revision.trazosAyuda')}</p>
      {pendientes > 0 ? (
        <button
          type="button"
          className="enlace"
          data-testid="abrir-trazo"
          onClick={() => {
            irATrazo(trazosPendientes(trazos, respuestas)[0]!, { enfocar: true });
            alAbrir(); // el foco ya va al título de la ficha: no se devuelve a la barra
          }}
        >
          {t('revision.trazoPrimero')}
        </button>
      ) : (
        <p>{t('revision.trazosListos')}</p>
      )}
    </details>
  );
}
