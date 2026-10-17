// Vistas anatómicas (F1) como brújula sobre el visor, y las métricas de cuadros y piezas.
import { useTranslation } from 'react-i18next';
import type { Vista } from '../lib/enlaces';
import { useAtlas } from '../store/useAtlas';
import { useMetricas } from './metricas';

/** Posición de cada vista en la brújula (cuadrícula de 3 x 3): superior arriba, inferior abajo, anterior al centro. */
const BRUJULA: [Vista, string][] = [
  ['superior', 'b-arriba'],
  ['lateral-der', 'b-izquierda'],
  ['anterior', 'b-centro'],
  ['lateral-izq', 'b-derecha'],
  ['inferior', 'b-abajo'],
  ['posterior', 'b-esquina'],
];

export function Metricas() {
  const { t } = useTranslation();
  const fps = useMetricas((s) => s.fps);
  const piezas = useMetricas((s) => s.piezas);
  return (
    <span className="metricas" aria-live="off">
      <span data-testid="fps">{t('visor.fps', { n: fps })}</span> · <span data-testid="piezas">{t('visor.piezas', { count: piezas })}</span>
    </span>
  );
}

export default function Vistas() {
  const { t } = useTranslation();
  const activa = useAtlas((s) => s.vistaActiva);
  return (
    <div className="brujula" role="toolbar" aria-label={t('vistas.titulo')}>
      {BRUJULA.map(([v, lugar]) => (
        <button
          key={v}
          type="button"
          className={activa === v ? `${lugar} activo` : lugar}
          aria-pressed={activa === v}
          data-vista={v}
          aria-label={t(`vistas.${v}`)}
          title={t(`vistas.${v}`)}
          onClick={() => useAtlas.getState().pedirCamara({ vista: v })}
        >
          {t(`vistas.corto.${v}`)}
        </button>
      ))}
    </div>
  );
}
