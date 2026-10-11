// Fragmentar (F6) y reensamblar (F7).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Nivel } from '../lib/explosion';
import { fueraDeSitio, hayFiltros, piezasDeEncuadre, useAtlas } from '../store/useAtlas';

/** Tiempo con el deslizador quieto antes de reencuadrar la cámara (no se reencuadra a cada paso). */
const ESPERA_ENCUADRE_MS = 300;

export default function BarraFragmentar() {
  const { t } = useTranslation();
  const explosion = useAtlas((s) => s.explosion);
  const nivel = useAtlas((s) => s.nivel);
  const armando = useAtlas((s) => s.armando);
  const enSitio = useAtlas((s) => (s.armando ? s.armando.total.filter((p) => !fueraDeSitio(s, p)).length : 0));
  const filtrado = useAtlas((s) => hayFiltros(s));
  const st = useAtlas.getState;
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La cámara encuadra el conjunto visible sin girar. Se espera a que el deslizador quede quieto.
  const pedirEncuadre = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      const s = useAtlas.getState();
      const foco = piezasDeEncuadre(s);
      if (foco.length) s.pedirCamara({ encuadrar: foco });
    }, ESPERA_ENCUADRE_MS);
  };

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  return (
    <div className="barra" role="toolbar" aria-label={t('fragmentar.titulo')}>
      <label className="barra-campo">
        {t('fragmentar.nivel')}
        <select value={nivel} onChange={(e) => {
            st().setNivel(e.target.value as Nivel);
            if (st().explosion > 0) pedirEncuadre();
          }}>
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
          onChange={(e) => {
            st().setExplosion(Number(e.target.value) / 100);
            pedirEncuadre();
          }}
          data-testid="explosion"
        />
        <output>{Math.round(explosion * 100)} %</output>
      </label>
      <button
        type="button"
        onClick={() => {
          st().reensamblarTodo();
          pedirEncuadre();
        }}
        data-testid="reensamblar"
      >
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
