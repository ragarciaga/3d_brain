// Autorización de tratamiento de datos del modo revisión (F24, ADR 0012, Ley 1581 de 2012).
// Modal: no pide nombre ni correo, solo una casilla obligatoria y la opcional del vago. Si registrar la
// autorización falla, sigue abierto con el aviso; nada cambia hasta que el canal confirma.
// El enlace al aviso de privacidad (#168) abre otra pestaña, para no salir del modo revisión.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Idioma } from '../data/tipos';
import { rutaPrivacidad } from '../lib/paginas';

export default function DialogoAutorizacion({
  alAceptar,
  alCerrar,
  vagoInicial = false,
}: {
  alAceptar: (vago: boolean) => Promise<void>;
  alCerrar: () => void;
  /** Valor con el que arranca la casilla del vago (la que el docente pidió en "Acciones"). La obligatoria arranca desmarcada. */
  vagoInicial?: boolean;
}) {
  const { t } = useTranslation();
  const { lang } = useParams();
  const idioma: Idioma = lang === 'en' ? 'en' : 'es';
  const [acepto, setAcepto] = useState(false);
  const [vago, setVago] = useState(vagoInicial);
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
          <Link to={rutaPrivacidad(idioma)} target="_blank" rel="noopener noreferrer">
            {t('privacidad.leer')}
          </Link>
        </p>
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
