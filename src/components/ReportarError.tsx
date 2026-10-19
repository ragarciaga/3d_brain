// "Reportar un error" (F12, spec 05): botón del pie de la ficha y su diálogo modal con el formulario.
// El reporte sale como un enlace a GitHub o como un correo: no hay petición de la app. Todo el estado del
// formulario vive en `FormularioReporte`, que solo existe con el diálogo abierto: cerrar lo descarta.
// Se pinta en un portal sobre el cuerpo: en celular la ficha es un contexto de apilamiento (z-index 15)
// y un diálogo dentro de ella quedaría debajo del recorrido y del panel izquierdo.
// Escape lo cierra por `accionEscape` ('cerrar-reporte'), que Pagina despacha como `atlas:cerrar-reporte`.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CORREO_REPORTES, MAX_DESCRIPCION, TIPOS, type TipoReporte } from '../config/reporte';
import type { Idioma } from '../data/tipos';
import { descripcionValida, cabeEnGithub, enlaceCorreo, enlaceGithub, partesDeFicha, type Reporte } from '../lib/reporte';
import { rutaPrivacidad } from '../lib/paginas';
import { useAtlas } from '../store/useAtlas';

export interface PropsReportarError {
  estructura: string;
  /** Nombre de la estructura (no el de la pieza) en el idioma de la interfaz. */
  nombre: string;
  idioma: Idioma;
  /** Versión de la ficha, o `sin-ficha`. */
  version: string;
}

type Traductor = ReturnType<typeof useTranslation>['t'];

/**
 * Cambia cada surrogate sin pareja por U+FFFD y conserva el largo. `encodeURIComponent` lanza ante un surrogate
 * suelto (se puede pegar uno); `toWellFormed` es ES2024 y el `lib` del proyecto es ES2023.
 */
function bienFormado(texto: string): string {
  let salida = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const siguiente = i + 1 < texto.length ? texto.charCodeAt(i + 1) : 0;
      if (siguiente >= 0xdc00 && siguiente <= 0xdfff) {
        salida += texto[i]! + texto[i + 1]!;
        i++;
      } else {
        salida += '�';
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      salida += '�';
    } else {
      salida += texto[i]!;
    }
  }
  return salida;
}

/** Texto de una parte de la ficha (id de F24). Una parte que no se conoce muestra su id. */
function etiquetaParte(parte: string, t: Traductor): string {
  const indexada = /^(relevancia|fuente)\.(\d+)$/.exec(parte);
  if (indexada) {
    const n = Number(indexada[2]) + 1;
    return indexada[1] === 'relevancia' ? t('reporte.parteRelevancia', { n }) : t('reporte.parteFuente', { n });
  }
  switch (parte) {
    case 'general':
      return t('reporte.parteGeneral');
    case 'nombre':
      return t('reporte.parteNombre');
    case 'latin':
      return t('ficha.latin');
    case 'sinonimos':
      return t('reporte.parteSinonimos');
    case 'pieza':
      return t('reporte.partePieza');
    case 'que_es':
      return t('ficha.queEs');
    case 'para_que_sirve':
      return t('ficha.paraQueSirve');
    case 'ubicacion':
      return t('ficha.ubicacion');
    case 'relaciones':
      return t('ficha.relaciones');
    case 'recursos':
      return t('reporte.parteRecursos');
    default:
      return parte;
  }
}

interface PropsFormulario extends PropsReportarError {
  cerrar: () => void;
}

function FormularioReporte(props: PropsFormulario) {
  const { t } = useTranslation();
  const [tipo, setTipo] = useState<TipoReporte | null>(null);
  const [parte, setParte] = useState('general');
  const [texto, setTexto] = useState('');
  const id = useId();
  const idMotivos = `${id}-motivos`;
  const idContador = `${id}-contador`;

  const valida = descripcionValida(texto);
  const listo = tipo !== null && valida;
  let hrefGithub: string | undefined;
  let hrefCorreo: string | undefined;
  let cabe = true;
  if (listo) {
    const r: Reporte = {
      tipo,
      estructura: props.estructura,
      nombre: props.nombre,
      idioma: props.idioma,
      version: props.version,
      parte,
      descripcion: bienFormado(texto),
    };
    cabe = cabeEnGithub(r, t);
    hrefGithub = cabe ? enlaceGithub(r, t) : undefined;
    hrefCorreo = enlaceCorreo(r, t);
  }

  return (
    <>
      <fieldset className="reporte-tipos">
        <legend>{t('reporte.tipoLeyenda')}</legend>
        {TIPOS.map((tp) => (
          <div key={tp} className="reporte-tipo">
            <label>
              <input type="radio" name={`${id}-tipo`} value={tp} checked={tipo === tp} onChange={() => setTipo(tp)} aria-describedby={`${id}-ayuda-${tp}`} />{' '}
              {t(`reporte.tipo.${tp}`)}
            </label>
            <span id={`${id}-ayuda-${tp}`} className="reporte-ayuda">
              {t(`reporte.tipoAyuda.${tp}`)}
            </span>
          </div>
        ))}
      </fieldset>
      <p className="reporte-campo">
        <label>
          {t('reporte.parte')}
          <select value={parte} onChange={(e) => setParte(e.currentTarget.value)}>
            {partesDeFicha(props.estructura).map((p) => (
              <option key={p} value={p}>
                {etiquetaParte(p, t)}
              </option>
            ))}
          </select>
        </label>
      </p>
      <p className="reporte-campo">
        <label>
          {t('reporte.descripcion')}
          <textarea
            rows={5}
            maxLength={MAX_DESCRIPCION}
            value={texto}
            onChange={(e) => setTexto(e.currentTarget.value.slice(0, MAX_DESCRIPCION))}
            aria-describedby={idContador}
          />
        </label>
        <span id={idContador} className="reporte-contador">
          {t('reporte.contador', { n: texto.length, max: MAX_DESCRIPCION })}
        </span>
      </p>
      <p>
        {t('reporte.aviso')}{' '}
        <Link to={rutaPrivacidad(props.idioma)} target="_blank" rel="noopener noreferrer">
          {t('privacidad.leer')}
        </Link>
      </p>
      <div className="reporte-acciones">
        <a
          role="link"
          {...(hrefGithub ? { href: hrefGithub, target: '_blank', rel: 'noopener noreferrer' } : { 'aria-disabled': true })}
          aria-describedby={idMotivos}
        >
          {t('reporte.abrirGithub')}
        </a>
        <a role="link" {...(hrefCorreo ? { href: hrefCorreo } : { 'aria-disabled': true })} aria-describedby={idMotivos}>
          {t('reporte.enviarCorreo')}
        </a>
      </div>
      <div id={idMotivos} className="reporte-motivos">
        {tipo === null && <p>{t('reporte.falta.tipo')}</p>}
        {!valida && <p>{t('reporte.falta.descripcion')}</p>}
        {listo && !cabe && <p>{t('reporte.muyLargo')}</p>}
      </div>
      <p className="reporte-correo">{t('reporte.correoTexto', { correo: CORREO_REPORTES })}</p>
      <button type="button" onClick={props.cerrar}>
        {t('reporte.cerrar')}
      </button>
    </>
  );
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
              <FormularioReporte {...props} cerrar={cerrar} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
