// Recorrido guiado del vago (F14, ADR 0009). Cada parada baja el plano de recorte hasta su nivel,
// encuadra su región y muestra la ubicación tomada de la ficha de su estructura principal, que cita
// sus fuentes. El recorrido no agrega texto anatómico propio.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre } from '../lib/nombres';
import { paradasVago } from '../lib/recorrido';
import { useAtlas } from '../store/useAtlas';
import { CONSULTA_MOVIL } from './useMovil';

const elegir = (entrada: string) => window.dispatchEvent(new CustomEvent('atlas:elegir', { detail: { entrada } }));

export default function RecorridoVago({ idioma }: { idioma: Idioma }) {
  const { t } = useTranslation();
  const paso = useAtlas((s) => s.recorrido);
  const conFicha = useAtlas((s) => !!s.seleccion.entrada);
  const panel = useRef<HTMLElement>(null);

  // En celular el panel va abajo (sin ficha abierta): el visor necesita su alto para encuadrar por encima.
  useEffect(() => {
    const el = panel.current;
    const mq = window.matchMedia(CONSULTA_MOVIL);
    const medir = () => useAtlas.getState().setPanelRecorrido(el && mq.matches && !conFicha ? Math.round(el.getBoundingClientRect().height) : 0);
    medir();
    mq.addEventListener('change', medir);
    const ro = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(medir);
    if (el) ro?.observe(el);
    return () => {
      mq.removeEventListener('change', medir);
      ro?.disconnect();
      useAtlas.getState().setPanelRecorrido(0);
    };
  }, [paso, conFicha]);

  if (paso === null) return null;
  const parada = paradasVago[paso]!;
  const total = paradasVago.length;
  const principal = estructuras[parada.principal];
  const s = useAtlas.getState;
  const ultima = paso === total - 1;

  return (
    <section ref={panel} className="recorrido" aria-labelledby="recorrido-titulo" data-testid="recorrido">
      <header className="recorrido-cabeza">
        <p className="recorrido-paso">
          {t('recorrido.titulo')} · {t('recorrido.parada', { n: paso + 1, total })}
        </p>
        <button type="button" className="cerrar" aria-label={t('recorrido.salir')} onClick={() => s().salirRecorrido()}>
          ×
        </button>
      </header>
      <div className="recorrido-cuerpo">
        <h2 id="recorrido-titulo">{t(`recorrido.paradas.${parada.id}`)}</h2>
        {principal && (
          <p className="recorrido-texto">
            <strong>{nombre(principal, idioma)}.</strong> {principal.ficha?.ubicacion[idioma] ?? t('ficha.enPreparacion')}{' '}
            <button type="button" className="enlace" onClick={() => elegir(parada.principal)}>
              {t('recorrido.verFicha')}
            </button>
          </p>
        )}
        {parada.relacionadas.length > 0 && (
          <details className="recorrido-ramos">
            <summary>{t('recorrido.enEstaParada', { n: parada.relacionadas.length })}</summary>
            <ul className="recorrido-chips">
              {parada.relacionadas
                .filter((id) => estructuras[id])
                .map((id) => (
                  <li key={id}>
                    <button type="button" className="chip" onClick={() => elegir(id)}>
                      {nombre(estructuras[id], idioma)}
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        )}
        {parada.id === 'torax' && <p className="recorrido-nota">{t('recorrido.notaToracico')}</p>}
        {parada.id === 'abdomen' && <p className="recorrido-nota">{t('recorrido.notaIzquierdo')}</p>}
        <p className="recorrido-nota">{t('recorrido.nota')}</p>
      </div>
      <div className="recorrido-botones">
        <button type="button" onClick={() => s().irAParada(paso - 1)} disabled={paso === 0}>
          {t('recorrido.anterior')}
        </button>
        <button
          type="button"
          className="boton-primario"
          data-testid="recorrido-siguiente"
          onClick={() => (ultima ? s().salirRecorrido() : s().irAParada(paso + 1))}
        >
          {ultima ? t('recorrido.terminar') : t('recorrido.siguiente')}
        </button>
      </div>
    </section>
  );
}
