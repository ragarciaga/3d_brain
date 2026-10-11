// Botones de vista anatómica (F1).
import { useTranslation } from 'react-i18next';
import { VISTAS } from '../lib/enlaces';
import { useAtlas } from '../store/useAtlas';
import { useMetricas } from './metricas';

export default function Vistas() {
  const { t } = useTranslation();
  const fps = useMetricas((s) => s.fps);
  const piezas = useMetricas((s) => s.piezas);
  return (
    <div className="vistas" role="toolbar" aria-label={t('vistas.titulo')}>
      {VISTAS.map((v) => (
        <button key={v} type="button" data-vista={v} onClick={() => useAtlas.getState().pedirCamara({ vista: v })}>
          {t(`vistas.${v}`)}
        </button>
      ))}
      <span className="metricas" aria-live="off">
        <span data-testid="fps">{t('visor.fps', { n: fps })}</span> · <span data-testid="piezas">{t('visor.piezas', { count: piezas })}</span>
      </span>
    </div>
  );
}
