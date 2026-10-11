// Búsqueda bilingüe (F3). Atajo Ctrl+K. Enter o clic: resalta, encuadra y abre la ficha.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { estructuras, padreDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { crearBuscador } from '../lib/busqueda';
import { nombreNodo, nombreVisible } from '../lib/nombres';
import { useAtlas } from '../store/useAtlas';

export default function Buscador({ idioma, alElegir }: { idioma: Idioma; alElegir: (entrada: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const ambos = useAtlas((s) => s.ambos);
  const input = useRef<HTMLInputElement>(null);
  const buscador = useMemo(() => crearBuscador(Object.values(estructuras)), []);
  const resultados = useMemo(() => buscador.buscar(q), [buscador, q]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  const elegir = (id: string) => {
    alElegir(id);
    setAbierto(false);
    setQ('');
    input.current?.blur();
  };

  return (
    <div className="buscador" role="search">
      <label htmlFor="buscar" className="solo-lector">
        {t('buscar.etiqueta')}
      </label>
      <input
        id="buscar"
        ref={input}
        type="search"
        autoComplete="off"
        placeholder={t('buscar.placeholder')}
        value={q}
        role="combobox"
        aria-expanded={abierto && resultados.length > 0}
        aria-controls="buscar-resultados"
        aria-activedescendant={resultados[activo] ? `res-${resultados[activo]}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActivo((a) => Math.min(a + 1, resultados.length - 1));
          else if (e.key === 'ArrowUp') setActivo((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && resultados[activo]) elegir(resultados[activo]!);
          else if (e.key === 'Escape') setAbierto(false);
        }}
      />
      {abierto && q.trim().length >= 2 && (
        <ul id="buscar-resultados" role="listbox" className="buscar-resultados" aria-label={t('buscar.resultados')}>
          {resultados.length === 0 && <li className="sin-resultados">{t('buscar.sinResultados')}</li>}
          {resultados.map((id, i) => {
            const padre = padreDeEntrada(id);
            return (
              <li
                key={id}
                id={`res-${id}`}
                role="option"
                aria-selected={i === activo}
                className={i === activo ? 'activo' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(id);
                }}
              >
                <span className="res-nombre">{nombreVisible(estructuras[id], idioma, ambos)}</span>
                {padre && (
                  <span className="res-ubicacion">{t('buscar.en', { lugar: nombreNodo(padre, idioma, false, t) })}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
