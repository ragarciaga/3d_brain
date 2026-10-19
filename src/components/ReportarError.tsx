// "Reportar un error" (F12, spec 05): botón del pie de la ficha y su diálogo modal.
// En T5 el diálogo es solo el cascarón (título y "Cerrar"); el formulario llega en T6.
// Se pinta en un portal sobre el cuerpo: en celular la ficha es un contexto de apilamiento (z-index 15)
// y un diálogo dentro de ella quedaría debajo del recorrido y del panel izquierdo.
// Escape lo cierra por `accionEscape` ('cerrar-reporte'), que Pagina despacha como `atlas:cerrar-reporte`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Idioma } from '../data/tipos';
import { useAtlas } from '../store/useAtlas';

export interface PropsReportarError {
  estructura: string;
  /** Nombre de la estructura (no el de la pieza) en el idioma de la interfaz. */
  nombre: string;
  idioma: Idioma;
  /** Versión de la ficha, o `sin-ficha`. */
  version: string;
}

export default function ReportarError(props: PropsReportarError) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const cerrar = useCallback(() => {
    setAbierto(false);
    boton.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    titulo.current?.focus({ preventScroll: true });
    useAtlas.getState().setDialogoReporte(true);
    window.addEventListener('atlas:cerrar-reporte', cerrar);
    return () => {
      window.removeEventListener('atlas:cerrar-reporte', cerrar);
      useAtlas.getState().setDialogoReporte(false);
    };
  }, [abierto, cerrar]);

  return (
    <>
      <button type="button" className="enlace" ref={boton} onClick={() => setAbierto(true)}>
        {t('reporte.boton')}
      </button>
      {abierto &&
        createPortal(
          <div className="aviso-modal">
            <div
              className="aviso-caja reporte-caja"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reporte-titulo"
              data-testid="dialogo-reporte"
            >
              <h2 id="reporte-titulo" ref={titulo} tabIndex={-1}>
                {t('reporte.titulo', { nombre: props.nombre })}
              </h2>
              <button type="button" onClick={cerrar}>
                {t('reporte.cerrar')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
