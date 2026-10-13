// Grupos de estudio (F2): filtros rápidos transversales a la jerarquía.
import { useTranslation } from 'react-i18next';
import { grupos, piezasDeGrupo } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { useAtlas } from '../store/useAtlas';

export default function GruposEstudio({ idioma, alElegir }: { idioma: Idioma; alElegir?: () => void }) {
  const { t } = useTranslation();
  const activo = useAtlas((s) => s.grupoActivo);
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
              alElegir?.(); // en celular, el cajón se cierra para ver el resultado
            }}
          >
            {g.nombre[idioma]}
          </button>
        ))}
      </div>
      {/* La descripción no solo en el título (al pasar el mouse): en tableta y celular no se vería. */}
      {activo && grupos.find((g) => g.id === activo) && (
        <p className="grupo-descripcion" data-testid="grupo-descripcion">
          {grupos.find((g) => g.id === activo)!.descripcion[idioma]}
        </p>
      )}
    </section>
  );
}
