// Leyenda de acabados (F25, ADR 0009): aparece cuando el modelo trae geometría trazada o un hueco en el
// vago del tórax (Plan B, ADR 0010). Explica los acabados y permite ver todo o solo lo medido; la fila
// "Trazada" y el filtro solo se muestran si hay algo trazado.
import { useTranslation } from 'react-i18next';
import { piezasAproximadas } from '../data/atlas';
import { useAtlas } from '../store/useAtlas';

export default function LeyendaOrigen({ aproximadas = piezasAproximadas }: { aproximadas?: string[] }) {
  const { t } = useTranslation();
  const solo = useAtlas((s) => s.soloEscaneada);
  const rutasVisibles = useAtlas((s) => s.rutas.length);
  const hayHuecos = useAtlas((s) => s.huecos.length > 0);
  const hayTrazado = aproximadas.length > 0 || rutasVisibles > 0;
  if (!hayTrazado && !hayHuecos) return null;
  return (
    <aside className="leyenda-origen" aria-label={t('origen.leyenda')} data-testid="leyenda-origen">
      <ul>
        <li>
          <span className="muestra muestra-escaneada" aria-hidden="true" />
          {t('origen.escaneada')}
        </li>
        {hayTrazado && (
          <li>
            <span className="muestra muestra-aproximada" aria-hidden="true" />
            {t('origen.aproximada')}
          </li>
        )}
        <li>
          <span className="muestra muestra-marcador" aria-hidden="true" />
          {t('origen.marcador')}
        </li>
        {hayHuecos && <li data-testid="leyenda-toracico">{t('origen.toracico')}</li>}
      </ul>
      {hayTrazado && (
        <label className="interruptor-pequeno">
          <input type="checkbox" checked={solo} onChange={(e) => useAtlas.getState().setSoloEscaneada(e.target.checked)} />{' '}
          {t('origen.soloEscaneada')}
        </label>
      )}
    </aside>
  );
}
