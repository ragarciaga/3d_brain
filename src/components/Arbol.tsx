// Árbol de estructuras (F2): jerarquía del modelo, casilla de visibilidad, contador y selección.
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { arbol, estructuras, marcadoresPorPadre, nodos, piezasBajo } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombreNodo, nombreVisible } from '../lib/nombres';
import { useAtlas } from '../store/useAtlas';

interface Props {
  idioma: Idioma;
  alElegir: (entrada: string) => void;
}

const Nodo = memo(function Nodo({ id, nivel, idioma, alElegir }: { id: string; nivel: number } & Props) {
  const { t } = useTranslation();
  const n = nodos[id]!;
  const [abierto, setAbierto] = useState(nivel < 1);
  const [verMarcadores, setVerMarcadores] = useState(false);
  const piezas = piezasBajo(id);
  const ocultas = useAtlas((s) => s.ocultas);
  const ambos = useAtlas((s) => s.ambos);
  const seleccion = useAtlas((s) => s.seleccion);
  const visiblesN = piezas.filter((p) => !ocultas.has(p)).length;
  const marcados = visiblesN === piezas.length;
  const parcial = visiblesN > 0 && !marcados;
  const entrada = n.tipo === 'pieza' ? n.estructura! : n.id;
  const activo = n.tipo === 'pieza' ? seleccion.pieza === id : seleccion.entrada === id;
  const etiqueta = nombreNodo(id, idioma, ambos, t);
  const extras = marcadoresPorPadre.get(id) ?? [];
  const tieneHijos = n.hijos.length > 0 || extras.length > 0;

  return (
    <li>
      <div className={`arbol-fila${activo ? ' activo' : ''}`} style={{ paddingInlineStart: `${nivel * 0.9}rem` }}>
        {tieneHijos ? (
          <button
            type="button"
            className="arbol-abrir"
            aria-label={abierto ? t('arbol.cerrar', { nombre: etiqueta }) : t('arbol.abrir', { nombre: etiqueta })}
            aria-expanded={abierto}
            onClick={() => setAbierto(!abierto)}
          >
            {abierto ? '▾' : '▸'}
          </button>
        ) : (
          <span className="arbol-abrir" aria-hidden="true" />
        )}
        <input
          type="checkbox"
          checked={marcados}
          ref={(el) => {
            if (el) el.indeterminate = parcial;
          }}
          aria-label={t('arbol.mostrar', { nombre: etiqueta })}
          onChange={(e) => useAtlas.getState().alternarVisibles(piezas, e.target.checked)}
        />
        <button
          type="button"
          className="arbol-nombre"
          data-nodo={id}
          aria-current={activo ? 'true' : undefined}
          onClick={() => {
            if (n.tipo === 'pieza') {
              const s = useAtlas.getState();
              s.seleccionar({ entrada, pieza: id });
              s.aislarPiezas([id], 'contexto');
              s.pedirCamara({ encuadrar: [id] });
            }
            alElegir(entrada);
          }}
        >
          {etiqueta}
        </button>
        {n.tipo === 'grupo' && (
          <span className="arbol-contador" title={t('arbol.contador')}>
            {visiblesN}/{piezas.length}
          </span>
        )}
        <button
          type="button"
          className="arbol-aislar"
          title={t('acciones.aislar')}
          aria-label={`${t('acciones.aislar')}: ${etiqueta}`}
          onClick={() => useAtlas.getState().aislarPiezas(piezas, 'solo')}
        >
          ◎
        </button>
      </div>
      {abierto && tieneHijos && (
        <ul>
          {n.hijos.map((h) => (
            <Nodo key={h} id={h} nivel={nivel + 1} idioma={idioma} alElegir={alElegir} />
          ))}
          {extras.length > 0 && (
            <li>
              <div className="arbol-fila" style={{ paddingInlineStart: `${(nivel + 1) * 0.9}rem` }}>
                <button
                  type="button"
                  className="arbol-abrir"
                  aria-label={t('arbol.sinMalla', { count: extras.length })}
                  onClick={() => setVerMarcadores(!verMarcadores)}
                >
                  {verMarcadores ? '▾' : '▸'}
                </button>
                <button type="button" className="arbol-nombre" onClick={() => setVerMarcadores(!verMarcadores)}>
                  {t('arbol.sinMalla', { count: extras.length })}
                </button>
              </div>
            </li>
          )}
          {verMarcadores && extras.map((m) => (
            <li key={m.id}>
              <div
                className={`arbol-fila marcador${seleccion.entrada === m.id ? ' activo' : ''}`}
                style={{ paddingInlineStart: `${(nivel + 2) * 0.9}rem` }}
              >
                <span className="arbol-abrir" aria-hidden="true" />
                <span className="arbol-icono" aria-hidden="true">
                  {m.estado === 'sin_ubicar' ? '○' : '●'}
                </span>
                <button type="button" className="arbol-nombre" data-nodo={m.id} onClick={() => alElegir(m.id)}>
                  {nombreVisible(estructuras[m.id], idioma, ambos)}
                </button>
                <span className="arbol-contador">{t(`marcador.${m.estado}`)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
});

export default function Arbol({ idioma, alElegir }: Props) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('arbol.titulo')} className="arbol">
      <ul>
        {arbol.raices.map((r) => (
          <Nodo key={r} id={r} nivel={0} idioma={idioma} alElegir={alElegir} />
        ))}
      </ul>
    </nav>
  );
}
