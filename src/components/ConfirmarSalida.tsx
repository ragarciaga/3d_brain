// Confirmación al salir del modo revisión: las respuestas no enviadas siguen en este navegador, salvo que se marque
// "Borrar también de este equipo".
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmarSalida({ alConfirmar, alCancelar }: { alConfirmar: (borrar: boolean) => void; alCancelar: () => void }) {
  const { t } = useTranslation();
  const [borrar, setBorrar] = useState(false);
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
        <label>
          <input
            type="checkbox"
            checked={borrar}
            onChange={(e) => setBorrar(e.target.checked)}
            data-testid="salir-borrar"
            aria-describedby="salir-borrar-ayuda"
          />{' '}
          {t('revision.salirBorrar')}
        </label>
        <p id="salir-borrar-ayuda" className="recurso-nota">
          {t('revision.salirBorrarAyuda')}
        </p>
        <button type="button" className="boton-primario" autoFocus onClick={alCancelar}>
          {t('revision.salirCancelar')}
        </button>{' '}
        <button type="button" onClick={() => alConfirmar(borrar)}>
          {t('revision.salirConfirmar')}
        </button>
      </div>
    </div>
  );
}
