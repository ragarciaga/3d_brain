// Búsqueda bilingüe (F3), dentro de la paleta que abre el riel o Ctrl+K. Enter o clic: resalta,
// encuadra y abre la ficha. Escape cierra la paleta.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { estructuras, padreDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { crearBuscador } from '../lib/busqueda';
import { nombre, nombreNodo } from '../lib/nombres';

export default function Buscador({ idioma, alElegir, alCerrar }: { idioma: Idioma; alElegir: (entrada: string) => void; alCerrar: () => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const buscador = useMemo(() => crearBuscador(Object.values(estructuras)), []);
  const resultados = useMemo(() => buscador.buscar(q), [buscador, q]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const elegir = (id: string) => {
    alElegir(id);
    setAbierto(false);
    setQ('');
    alCerrar();
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
          else if (e.key === 'Escape') {
            e.stopPropagation();
            alCerrar();
          }
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
                <span className="res-nombre">{nombre(estructuras[id], idioma)}</span>
                {padre && (
                  <span className="res-ubicacion">{t('buscar.en', { lugar: nombreNodo(padre, idioma, t) })}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
