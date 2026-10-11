// Grupos de estudio (F2): filtros rápidos transversales a la jerarquía.
import { useTranslation } from 'react-i18next';
import { grupos, piezasDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { useAtlas } from '../store/useAtlas';

export function piezasDeGrupo(id: string): string[] {
  const g = grupos.find((x) => x.id === id);
  if (!g) return [];
  return [...new Set(g.miembros.flatMap((m) => piezasDeEntrada(m)))];
}

export default function GruposEstudio({ idioma }: { idioma: Idioma }) {
  const { t } = useTranslation();
  const activo = useAtlas((s) => s.grupoActivo);
  const ambos = useAtlas((s) => s.ambos);
  const otro: Idioma = idioma === 'es' ? 'en' : 'es';
  return (
    <section aria-labelledby="titulo-grupos" className="grupos">
      <h2 id="titulo-grupos">{t('grupos.titulo')}</h2>
      <div className="grupos-lista">
        {grupos.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`chip${activo === g.id ? ' activo' : ''}`}
            aria-pressed={activo === g.id}
            title={g.descripcion[idioma]}
            data-grupo={g.id}
            onClick={() => {
              const s = useAtlas.getState();
              if (activo === g.id) s.activarGrupo(null);
              else {
                const piezas = piezasDeGrupo(g.id);
                s.activarGrupo(g.id, piezas);
                s.pedirCamara({ encuadrar: piezas });
              }
            }}
          >
            {g.nombre[idioma]}
            {ambos ? ` / ${g.nombre[otro]}` : ''}
          </button>
        ))}
      </div>
    </section>
  );
}
