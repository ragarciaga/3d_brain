// Leyenda de acabados (F25, ADR 0009): aparece cuando el modelo trae geometría trazada, explica los
// tres acabados y permite verla toda o solo lo medido.
import { useTranslation } from 'react-i18next';
import { piezasAproximadas } from '../data/atlas';
import { useAtlas } from '../store/useAtlas';

export default function LeyendaOrigen({ aproximadas = piezasAproximadas }: { aproximadas?: string[] }) {
  const { t } = useTranslation();
  const solo = useAtlas((s) => s.soloEscaneada);
  const rutasVisibles = useAtlas((s) => s.rutas.length);
  const toracico = useAtlas((s) => s.rutas.some((r) => r.reemplaza !== undefined));
  if (!aproximadas.length && !rutasVisibles) return null;
  return (
    <aside className="leyenda-origen" aria-label={t('origen.leyenda')} data-testid="leyenda-origen">
      <ul>
        <li>
          <span className="muestra muestra-escaneada" aria-hidden="true" />
          {t('origen.escaneada')}
        </li>
        <li>
          <span className="muestra muestra-aproximada" aria-hidden="true" />
          {t('origen.aproximada')}
        </li>
        <li>
          <span className="muestra muestra-marcador" aria-hidden="true" />
          {t('origen.marcador')}
        </li>
        {toracico && <li data-testid="leyenda-toracico">{t('origen.toracico')}</li>}
      </ul>
      <label className="interruptor-pequeno">
        <input type="checkbox" checked={solo} onChange={(e) => useAtlas.getState().setSoloEscaneada(e.target.checked)} />{' '}
        {t('origen.soloEscaneada')}
      </label>
    </aside>
  );
}
