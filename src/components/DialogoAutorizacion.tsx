// Autorización de tratamiento de datos del modo revisión (F24, ADR 0012, Ley 1581 de 2012).
// Modal: no pide nombre ni correo, solo una casilla obligatoria y la opcional del vago. Si registrar la
// autorización falla, sigue abierto con el aviso; nada cambia hasta que el canal confirma.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DialogoAutorizacion({
  alAceptar,
  alCerrar,
}: {
  alAceptar: (vago: boolean) => Promise<void>;
  alCerrar: () => void;
}) {
  const { t } = useTranslation();
  const [acepto, setAcepto] = useState(false);
  const [vago, setVago] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  // El control que abrió el diálogo: el foco vuelve a él al cerrarse.
  const [origen] = useState(() => document.activeElement as HTMLElement | null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    titulo.current?.focus({ preventScroll: true });
    return () => {
      montado.current = false;
      if (origen && origen !== document.body && origen.isConnected) origen.focus({ preventScroll: true });
    };
  }, [origen]);

  const continuar = async () => {
    setEnviando(true);
    setError(false);
    try {
      await alAceptar(vago);
    } catch {
      if (montado.current) setError(true);
    } finally {
      if (montado.current) setEnviando(false);
    }
  };

  return (
    <div className="aviso-modal">
      <div
        className="aviso-caja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autorizacion-titulo"
        aria-describedby="autorizacion-texto"
        data-testid="dialogo-autorizacion"
      >
        <h2 id="autorizacion-titulo" ref={titulo} tabIndex={-1}>
          {t('revision.autorizacion.titulo')}
        </h2>
        <p id="autorizacion-texto">{t('revision.autorizacion.texto')}</p>
        <p>
          <label>
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.currentTarget.checked)} />{' '}
            {t('revision.autorizacion.acepto')}
          </label>
        </p>
        <p>
          <label>
            <input type="checkbox" checked={vago} onChange={(e) => setVago(e.currentTarget.checked)} />{' '}
            {t('revision.autorizacion.vago')}
          </label>
        </p>
        {error && (
          <p role="alert" className="etiqueta-aviso">
            {t('revision.autorizacion.sinConexion')}
          </p>
        )}
        <button type="button" className="boton-primario" disabled={!acepto || enviando} onClick={() => void continuar()}>
          {t('revision.autorizacion.continuar')}
        </button>{' '}
        <button type="button" onClick={alCerrar}>
          {t('comun.cerrar')}
        </button>
      </div>
    </div>
  );
}
