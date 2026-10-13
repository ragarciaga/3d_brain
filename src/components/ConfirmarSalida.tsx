// Confirmación al salir del modo revisión: las respuestas no enviadas siguen en este navegador.
import { useTranslation } from 'react-i18next';

export default function ConfirmarSalida({ alConfirmar, alCancelar }: { alConfirmar: () => void; alCancelar: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="aviso-modal" onMouseDown={(e) => e.target === e.currentTarget && alCancelar()}>
      <div
        className="aviso-caja"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="salir-titulo"
        aria-describedby="salir-texto"
        data-testid="confirmar-salida"
      >
        <h2 id="salir-titulo">{t('revision.salirTitulo')}</h2>
        <p id="salir-texto">{t('revision.salirTexto')}</p>
        <button type="button" className="boton-primario" autoFocus onClick={alCancelar}>
          {t('revision.salirCancelar')}
        </button>{' '}
        <button type="button" onClick={alConfirmar}>
          {t('revision.salirConfirmar')}
        </button>
      </div>
    </div>
  );
}
