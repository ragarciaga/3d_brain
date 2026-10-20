// Leyenda de acabados (F25, ADR 0009): aparece cuando el modelo trae geometría trazada o un hueco en el
// vago del tórax (Plan B, ADR 0010). Explica los acabados y permite ver todo o solo lo medido; la fila
// "Trazada" y el filtro solo se muestran si hay algo trazado. Es plegable: en celular arranca plegada como un
// botón pequeño (con el aviso corto del hueco, si lo hay) y en escritorio desplegada; después del primer toque
// se respeta la elección de la persona durante la sesión.
import { useTranslation } from 'react-i18next';
import { piezasAproximadas } from '../data/atlas';
import { useAtlas } from '../store/useAtlas';
import { useMovil } from './useMovil';

/** Plegada o no: la elección de la persona si ya tocó el botón; si no, plegada en celular. */
export function plegadaEfectiva(elegida: boolean | null, movil: boolean): boolean {
  return elegida ?? movil;
}

interface PropsVista {
  plegada: boolean;
  hayTrazado: boolean;
  hayHuecos: boolean;
  solo: boolean;
  alAlternar(): void;
  alFiltrar(v: boolean): void;
}

export function VistaLeyenda({ plegada, hayTrazado, hayHuecos, solo, alAlternar, alFiltrar }: PropsVista) {
  const { t } = useTranslation();
  return (
    <aside className={'leyenda-origen' + (plegada ? ' plegada' : '')} aria-label={t('origen.leyenda')} data-testid="leyenda-origen">
      <button
        type="button"
        className="leyenda-boton"
        data-testid="leyenda-boton"
        aria-expanded={!plegada}
        aria-controls="leyenda-origen-contenido"
        onClick={alAlternar}
      >
        {t('origen.boton')}
        {plegada && hayHuecos && (
          <span className="leyenda-hueco-breve" data-testid="leyenda-hueco-breve">
            {t('origen.huecoBreve')}
          </span>
        )}
      </button>
      <div id="leyenda-origen-contenido" hidden={plegada}>
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
            <input type="checkbox" checked={solo} onChange={(e) => alFiltrar(e.target.checked)} />{' '}
            {t('origen.soloEscaneada')}
          </label>
        )}
      </div>
    </aside>
  );
}

export default function LeyendaOrigen({ aproximadas = piezasAproximadas }: { aproximadas?: string[] }) {
  const solo = useAtlas((s) => s.soloEscaneada);
  const rutasVisibles = useAtlas((s) => s.rutas.length);
  const hayHuecos = useAtlas((s) => s.huecos.length > 0);
  const elegida = useAtlas((s) => s.leyendaPlegada);
  const movil = useMovil();
  const hayTrazado = aproximadas.length > 0 || rutasVisibles > 0;
  if (!hayTrazado && !hayHuecos) return null;
  const plegada = plegadaEfectiva(elegida, movil);
  return (
    <VistaLeyenda
      plegada={plegada}
      hayTrazado={hayTrazado}
      hayHuecos={hayHuecos}
      solo={solo}
      alAlternar={() => useAtlas.getState().setLeyendaPlegada(!plegada)}
      alFiltrar={(v) => useAtlas.getState().setSoloEscaneada(v)}
    />
  );
}
