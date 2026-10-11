// Fragmentar (F6) y reensamblar (F7).
import { useTranslation } from 'react-i18next';
import type { Nivel } from '../lib/explosion';
import { fueraDeSitio, hayFiltros, useAtlas } from '../store/useAtlas';

export default function BarraFragmentar() {
  const { t } = useTranslation();
  const explosion = useAtlas((s) => s.explosion);
  const nivel = useAtlas((s) => s.nivel);
  const armando = useAtlas((s) => s.armando);
  const enSitio = useAtlas((s) => (s.armando ? s.armando.total.filter((p) => !fueraDeSitio(s, p)).length : 0));
  const filtrado = useAtlas((s) => hayFiltros(s));
  const st = useAtlas.getState;

  return (
    <div className="barra" role="toolbar" aria-label={t('fragmentar.titulo')}>
      <label className="barra-campo">
        {t('fragmentar.nivel')}
        <select value={nivel} onChange={(e) => st().setNivel(e.target.value as Nivel)}>
          <option value="hemisferios">{t('fragmentar.hemisferios')}</option>
          <option value="lobulos">{t('fragmentar.lobulos')}</option>
          <option value="piezas">{t('fragmentar.piezas')}</option>
        </select>
      </label>
      <label className="barra-campo barra-deslizador">
        {t('fragmentar.explosion')}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(explosion * 100)}
          aria-valuetext={`${Math.round(explosion * 100)} %`}
          onChange={(e) => st().setExplosion(Number(e.target.value) / 100)}
          data-testid="explosion"
        />
        <output>{Math.round(explosion * 100)} %</output>
      </label>
      <button type="button" onClick={() => st().reensamblarTodo()} data-testid="reensamblar">
        {t('fragmentar.reensamblar')}
      </button>
      {armando ? (
        <span className="armado" role="status" data-testid="contador-armado">
          {enSitio === armando.total.length
            ? t('fragmentar.armadoCompleto', { total: armando.total.length })
            : t('fragmentar.contador', { n: enSitio, total: armando.total.length })}{' '}
          <button type="button" onClick={() => st().terminarArmado()}>
            {t('fragmentar.terminar')}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => st().armarPiezaPorPieza()} title={t('fragmentar.armarAyuda')}>
          {t('fragmentar.armar')}
        </button>
      )}
      {filtrado && (
        <button type="button" onClick={() => st().mostrarTodo()} data-testid="mostrar-todo">
          {t('acciones.mostrarTodo')}
        </button>
      )}
    </div>
  );
}
