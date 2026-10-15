// Panel de cortes (F8): tres planos con interruptor, deslizador de 1 mm e "Invertir", el fantasma de la
// parte cortada y "Quitar cortes". Flota junto al riel en escritorio y es un cajón inferior en celular
// (ahí queda montado: cerrado está `inert`). Solo habla con el store; el visor dibuja los cortes.
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PLANOS, etiquetaCorte, piezasEncefalo, rangoCerebro, type Plano } from '../lib/cortes';
import { useAtlas } from '../store/useAtlas';

export default function PanelCortes({ abierto, movil }: { abierto: boolean; movil: boolean }) {
  const { t } = useTranslation();
  const raiz = useRef<HTMLElement>(null);

  // Al abrir el cajón del celular el foco entra en él (igual que el cajón de Estructuras).
  useEffect(() => {
    if (!abierto || !movil) return;
    raiz.current?.querySelector<HTMLElement>('button, input, select, a[href]')?.focus({ preventScroll: true });
  }, [abierto, movil]);
  const cortes = useAtlas((s) => s.cortes);
  const cajas = useAtlas((s) => s.cajas);
  const fantasma = useAtlas((s) => s.fantasmaCorte);
  const rellenoApagado = useAtlas((s) => s.rellenoApagado);
  const rango = useMemo(() => rangoCerebro(cajas, piezasEncefalo), [cajas]);

  // Claves literales (no `cortes.plano.${p}`), para que `clavesFaltantes` las vea.
  const nombre: Record<Plano, string> = {
    sagital: t('cortes.plano.sagital'),
    coronal: t('cortes.plano.coronal'),
    axial: t('cortes.plano.axial'),
  };
  const posicion: Record<Plano, string> = {
    sagital: t('cortes.posicion.sagital'),
    coronal: t('cortes.posicion.coronal'),
    axial: t('cortes.posicion.axial'),
  };
  const invertirPlano: Record<Plano, string> = {
    sagital: t('cortes.invertirPlano.sagital'),
    coronal: t('cortes.invertirPlano.coronal'),
    axial: t('cortes.invertirPlano.axial'),
  };

  return (
    <section
      ref={raiz}
      id="panel-cortes"
      className="panel-cortes"
      aria-labelledby="cortes-titulo"
      data-testid="panel-cortes"
      inert={!abierto}
    >
      <h2 id="cortes-titulo">{t('cortes.titulo')}</h2>
      <p className="cortes-aviso" data-testid="cortes-aviso">
        {t('cortes.aviso')}
      </p>
      <div role="status">
        {rellenoApagado && (
          <p className="cortes-relleno" data-testid="cortes-relleno-apagado">
            {t('cortes.rellenoApagado')}
          </p>
        )}
      </div>
      {PLANOS.map((p) => {
        const c = cortes[p];
        return (
          <div key={p} className="fila-corte" data-plano={p} data-testid={`fila-corte-${p}`}>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={c.activo}
                onChange={(e) => useAtlas.getState().setCorte(p, { activo: e.currentTarget.checked })}
              />{' '}
              {nombre[p]}
            </label>
            <button
              type="button"
              aria-pressed={c.invertido}
              disabled={!c.activo}
              aria-label={invertirPlano[p]}
              onClick={() => useAtlas.getState().setCorte(p, { invertido: !c.invertido })}
            >
              {t('cortes.invertir')}
            </button>
            <input
              type="range"
              min={rango.min[p]}
              max={rango.max[p]}
              step={1}
              value={c.mm}
              disabled={!c.activo}
              aria-label={posicion[p]}
              aria-valuetext={etiquetaCorte(p, c.mm, t)}
              onChange={(e) => useAtlas.getState().setCorte(p, { mm: Number(e.currentTarget.value) })}
            />
            <span className="corte-etiqueta" aria-hidden="true" data-testid={`etiqueta-corte-${p}`}>
              {c.activo ? etiquetaCorte(p, c.mm, t) : ''}
            </span>
          </div>
        );
      })}
      <label className="interruptor">
        <input
          type="checkbox"
          checked={fantasma}
          aria-describedby="cortes-fantasma-ayuda"
          onChange={(e) => useAtlas.getState().setFantasmaCorte(e.currentTarget.checked)}
        />{' '}
        {t('cortes.fantasma')}
      </label>
      <p id="cortes-fantasma-ayuda" className="cortes-ayuda">
        {t('cortes.fantasmaAyuda')}
      </p>
      <button type="button" className="cortes-quitar" onClick={() => useAtlas.getState().quitarCortes()}>
        {t('cortes.quitar')}
      </button>
    </section>
  );
}
