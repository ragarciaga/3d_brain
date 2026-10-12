// Fragmentar (F6) y reensamblar (F7).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { nodos } from '../data/atlas';
import type { Nivel } from '../lib/explosion';
import { hayFiltros, piezasDeEncuadre, piezasVisibles, useAtlas } from '../store/useAtlas';

/** Tiempo con el deslizador quieto antes de reencuadrar la cámara (no se reencuadra a cada paso). */
const ESPERA_ENCUADRE_MS = 300;

export default function BarraFragmentar() {
  const { t } = useTranslation();
  const explosion = useAtlas((s) => s.explosion);
  const nivel = useAtlas((s) => s.nivel);
  const filtrado = useAtlas((s) => hayFiltros(s));
  const st = useAtlas.getState;
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La cámara encuadra el conjunto visible sin girar. Se espera a que el deslizador quede quieto.
  const pedirEncuadre = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      const s = useAtlas.getState();
      // El inventario está en el plano frontal: se mira de frente y entra todo, también el vago.
      if (s.inventario) {
        const todas = piezasVisibles(s).filter((p) => nodos[p]?.clase === 'estudio');
        if (todas.length) s.pedirCamara({ vista: 'anterior', encuadrar: todas });
        return;
      }
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

  const pct = Math.round(explosion * 100);
  return (
    <div className="dock" role="toolbar" aria-label={t('fragmentar.titulo')} aria-orientation="vertical">
      <div className="dock-niveles" role="group" aria-label={t('fragmentar.nivel')}>
        {(['hemisferios', 'lobulos', 'piezas'] as Nivel[]).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={nivel === n}
            className={nivel === n ? 'activo' : undefined}
            onClick={() => {
              st().setNivel(n);
              if (st().explosion > 0) pedirEncuadre();
            }}
          >
            {t(`fragmentar.${n}`)}
          </button>
        ))}
      </div>
      <div className="dock-deslizador">
        <ol className="dock-marcas" aria-hidden="true">
          <li style={{ bottom: '100%' }}>{t('fragmentar.marcaInventario')}</li>
          <li style={{ bottom: '70%' }}>{t('fragmentar.marcaSeparado')}</li>
          <li style={{ bottom: '0%' }}>{t('fragmentar.marcaArmado')}</li>
        </ol>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label={t('fragmentar.explosion')}
          aria-valuetext={`${pct} %`}
          aria-orientation="vertical"
          onChange={(e) => {
            st().setExplosion(Number(e.target.value) / 100);
            pedirEncuadre();
          }}
          data-testid="explosion"
        />
      </div>
      <output className="dock-valor">{pct} %</output>
      <button
        type="button"
        className="dock-reensamblar"
        onClick={() => {
          st().reensamblarTodo();
          pedirEncuadre();
        }}
        data-testid="reensamblar"
        title={t('fragmentar.reensamblar')}
      >
        <span aria-hidden="true">⟲</span> {t('fragmentar.reensamblar')}
      </button>
      {filtrado && (
        <button type="button" className="dock-mostrar" onClick={() => st().mostrarTodo()} data-testid="mostrar-todo">
          {t('acciones.mostrarTodo')}
        </button>
      )}
    </div>
  );
}
