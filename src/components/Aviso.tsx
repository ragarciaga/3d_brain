// Aviso de uso educativo (SPEC sección 13): en la primera visita y siempre en el pie.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const CLAVE = 'atlas:aviso-visto';

function yaVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

export default function AvisoPrimeraVisita() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !yaVisto());
  if (!visible) return null;
  return (
    <div className="aviso-modal" role="dialog" aria-modal="true" aria-labelledby="aviso-titulo">
      <div className="aviso-caja">
        <h2 id="aviso-titulo">{t('aviso.titulo')}</h2>
        <p>{t('aviso.educativo')}</p>
        <p>{t('aviso.unCuerpo')}</p>
        <p>{t('aviso.borrador')}</p>
        <button
          type="button"
          className="boton-primario"
          autoFocus
          onClick={() => {
            try {
              localStorage.setItem(CLAVE, '1');
            } catch {
              /* sin almacenamiento: el aviso vuelve a salir la próxima vez */
            }
            setVisible(false);
          }}
        >
          {t('aviso.entendido')}
        </button>
      </div>
    </div>
  );
}
