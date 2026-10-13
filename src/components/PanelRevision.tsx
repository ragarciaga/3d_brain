// Modo revisión docente (F24): avance, fichas pendientes y envío por formulario de Google.
import { get, set } from 'idb-keyval';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { nombre, nombrePendiente } from '../lib/nombres';
import { avanceDeFicha, avanceGlobal, ordenDeRevision } from '../lib/prioridad';
import {
  cargaRevision,
  desactualizadas,
  formularioConfigurado,
  respuestaCompleta,
  separarIncompletas,
  urlsFormulario,
  type Respuesta,
} from '../lib/revision';
import { crearRespaldo, leerRespaldo, MAX_RESPALDO_CARACTERES, type ErrorRespaldo } from '../lib/respaldo';
import { useAtlas } from '../store/useAtlas';
import { useMovil } from './useMovil';

const claveIdb = (codigo: string) => `revision:${codigo}`;
const versionActual = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
const claveGuia = (codigo: string) => `atlas:guia-vista:${codigo}`;
type Vista = 'que' | 'como' | 'enviar' | null;
const ID_TITULO = 'dialogo-revision-titulo'; // solo hay un diálogo abierto a la vez

function guiaVista(codigo: string): boolean {
  try {
    return localStorage.getItem(claveGuia(codigo)) === '1';
  } catch {
    return true; // sin almacenamiento no se insiste: la guía queda a un toque
  }
}

function marcarGuiaVista(codigo: string) {
  try {
    localStorage.setItem(claveGuia(codigo), '1');
  } catch {
    /* nada que guardar */
  }
}

function descargarArchivo(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PanelRevision({
  idioma,
  alElegir,
  alSalir,
}: {
  idioma: Idioma;
  alElegir: (id: string) => void;
  alSalir: (origen: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const movil = useMovil();
  const [accionesAbiertas, setAccionesAbiertas] = useState(false);
  const botonAcciones = useRef<HTMLButtonElement>(null);
  const revisor = useAtlas((s) => s.revisor);
  const respuestas = useAtlas((s) => s.respuestas);
  const [elegida, setElegida] = useState<Vista | 'ninguna'>(null);
  const rutas = useAtlas((s) => s.rutas);
  const [enviadas, setEnviadas] = useState<Record<string, string>>({});
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [partes, setPartes] = useState<{ id: string; urls: string[] } | null>(null);

  useEffect(() => {
    if (!revisor) return;
    let vigente = true;
    get(claveIdb(revisor))
      .then((guardado: { respuestas?: Record<string, Respuesta>; enviadas?: Record<string, string> } | undefined) => {
        if (!vigente) return;
        useAtlas.getState().cargarRespuestas(guardado?.respuestas ?? {});
        setEnviadas(guardado?.enviadas ?? {});
      })
      .catch(() => undefined)
      .finally(() => vigente && setCargadoDe(revisor));
    return () => {
      vigente = false;
    };
  }, [revisor]);

  useEffect(() => {
    if (!revisor || cargadoDe !== revisor) return;
    set(claveIdb(revisor), { respuestas, enviadas }).catch(() => undefined);
  }, [revisor, respuestas, enviadas, cargadoDe]);

  const porEstructura = useMemo(() => {
    const m = new Map<string, Respuesta[]>();
    for (const r of Object.values(respuestas)) m.set(r.estructura, [...(m.get(r.estructura) ?? []), r]);
    return m;
  }, [respuestas]);

  // Un "Corregir" sin texto no es una respuesta: no suma al avance ni saca la ficha de la lista.
  const respondidas = useMemo(
    () => new Set(Object.entries(respuestas).filter(([, r]) => respuestaCompleta(r)).map(([k]) => k)),
    [respuestas],
  );

  // La primera vez que un docente entra con su código, la guía se abre sola.
  const vista: Vista = !revisor ? null : elegida === 'ninguna' ? null : (elegida ?? (guiaVista(revisor) ? null : 'como'));
  const titulo = useRef<HTMLHeadingElement>(null);
  const botones = useRef<Partial<Record<'que' | 'como' | 'enviar', HTMLButtonElement | null>>>({});
  const [avisoRespaldo, setAvisoRespaldo] = useState('');
  const entradaRespaldo = useRef<HTMLInputElement>(null);

  // Al abrir un diálogo, el foco va a su título: así se anuncia y Escape queda a un toque.
  useEffect(() => {
    if (vista) titulo.current?.focus({ preventScroll: true });
  }, [vista]);

  // Escape (Pagina) cierra el diálogo; solo la confirmación de salida va antes.
  useEffect(() => {
    useAtlas.getState().setDialogoRevision(vista !== null);
    return () => useAtlas.getState().setDialogoRevision(false);
  }, [vista]);

  const cerrar = useCallback(
    (devolverFoco: boolean) => {
      if (!revisor) return;
      if (vista === 'como') marcarGuiaVista(revisor);
      setElegida('ninguna');
      // En escritorio el foco vuelve al botón de la barra; en celular esos botones están en el menú
      // cerrado, así que vuelve a "Acciones". Se enfoca antes de que el diálogo se desmonte.
      const destino = movil ? botonAcciones.current : vista ? botones.current[vista] : null;
      if (devolverFoco) destino?.focus();
    },
    [revisor, vista, movil],
  );

  useEffect(() => {
    const alCerrar = () => cerrar(true);
    window.addEventListener('atlas:cerrar-revision', alCerrar);
    return () => window.removeEventListener('atlas:cerrar-revision', alCerrar);
  }, [cerrar]);

  if (!revisor) return null;
  const abrir = (v: Vista) => {
    if (vista === 'como' || v === 'como') marcarGuiaVista(revisor);
    setElegida(v ?? 'ninguna');
  };
  const lista = Object.values(respuestas);
  const viejas = desactualizadas(lista, versionActual);
  const secciones = ordenDeRevision(respondidas, idioma, rutas);
  const global = avanceGlobal(respondidas, idioma, rutas);
  const totalPendientes = secciones.reduce((n, x) => n + x.ids.length, 0);
  const alternar = (v: Vista) => abrir(vista === v ? null : v);
  const configurado = formularioConfigurado(configRevision);

  const copiarODescargar = async (id: string, l: Respuesta[]) => {
    const carga = cargaRevision(revisor, id, l);
    try {
      await navigator.clipboard.writeText(carga);
      setAviso(t('revision.copiada'));
    } catch {
      const url = URL.createObjectURL(new Blob([carga], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `revision-${revisor}-${id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso(t('revision.descargada'));
    }
  };

  const enviar = async (id: string, l: Respuesta[]) => {
    const urls = urlsFormulario(configRevision, revisor, id, l);
    if (urls.length === 1) window.open(urls[0], '_blank', 'noopener');
    else if (urls.length > 1) setPartes({ id, urls });
    else await copiarODescargar(id, l);
    setEnviadas({ ...enviadas, [id]: new Date().toISOString() });
  };

  const descargarRespaldo = () =>
    descargarArchivo(`respaldo-revision-${revisor}-${new Date().toISOString().slice(0, 10)}.json`, crearRespaldo(revisor, respuestas));

  // Llamadas literales a `t` para que check:i18n las vea.
  const mensajeError = (e: ErrorRespaldo) =>
    e === 'version' ? t('revision.respaldoErrorVersion') : e === 'otroRevisor' ? t('revision.respaldoErrorRevisor') : t('revision.respaldoErrorArchivo');

  // El archivo es entrada externa: leerRespaldo lo valida y solo entra lo que pasa; se fusiona con lo local.
  const cargarArchivo = async (input: HTMLInputElement) => {
    const archivo = input.files?.[0];
    input.value = ''; // deja volver a elegir el mismo archivo
    if (!archivo) return;
    if (archivo.size > MAX_RESPALDO_CARACTERES) return setAvisoRespaldo(mensajeError('grande'));
    const texto = await archivo.text().catch(() => null);
    if (texto === null) return setAvisoRespaldo(mensajeError('formato'));
    const s = useAtlas.getState();
    if (s.revisor !== revisor) return; // salió del modo revisión mientras se leía el archivo
    const l = leerRespaldo(texto, { revisor, idOk: (id) => typeof id === 'string' && Object.hasOwn(estructuras, id) });
    if (!l.ok) return setAvisoRespaldo(mensajeError(l.error));
    const f = s.importarRespuestas(l.respuestas);
    const resumen = t('revision.respaldoCargado', { agregadas: f.agregadas, actualizadas: f.actualizadas, sinCambio: f.sinCambio });
    setAvisoRespaldo(l.descartadas > 0 ? `${resumen} ${t('revision.respaldoOmitidas', { count: l.descartadas })}` : resumen);
  };

  // Elegir una acción del menú de celular lo cierra y abre (o cierra) el diálogo de esa acción.
  const elegir = (v: Vista) => {
    setAccionesAbiertas(false);
    alternar(v);
  };

  // Respaldo (#60). No usan `elegir`: en celular el menú sigue abierto y se ve el resultado. El input de
  // archivo va fuera del menú (en la raíz de la barra) para que sobreviva si el menú se desmonta.
  const accionesRespaldo = (
    <>
      <button type="button" disabled={lista.length === 0} onClick={descargarRespaldo}>
        {t('revision.descargarRespaldo')}
      </button>
      <button type="button" disabled={cargadoDe !== revisor} onClick={() => entradaRespaldo.current?.click()}>
        {t('revision.cargarRespaldo')}
      </button>
    </>
  );
  const notasRespaldo = (
    <>
      <p className="aviso-local recurso-nota" data-testid="aviso-local">
        {t('revision.soloEsteNavegador')}
      </p>
      {avisoRespaldo && (
        <p className="aviso-respaldo" role="status" data-testid="aviso-respaldo">
          {avisoRespaldo}
        </p>
      )}
    </>
  );

  // Las acciones se escriben una sola vez: en línea en escritorio, dentro del menú "Acciones" en celular.
  const acciones = (
    <>
      <button type="button" ref={(el) => { botones.current.que = el; }} aria-expanded={vista === 'que'} onClick={() => elegir('que')}>
        {t('revision.queRevisar', { count: totalPendientes })}
      </button>
      <button type="button" ref={(el) => { botones.current.como = el; }} aria-expanded={vista === 'como'} onClick={() => elegir('como')}>
        {t('revision.comoRevisar')}
      </button>
      <button
        type="button"
        ref={(el) => { botones.current.enviar = el; }}
        className="boton-primario"
        aria-expanded={vista === 'enviar'}
        onClick={() => elegir('enviar')}
      >
        {t('revision.enviar')}
      </button>
      {accionesRespaldo}
    </>
  );
  const notas = (
    <>
      {viejas.length > 0 && <span className="etiqueta-aviso">{t('revision.desactualizadas', { count: viejas.length })}</span>}
      {notasRespaldo}
    </>
  );

  return (
    <div className="panel-revision" role="region" aria-label={t('revision.titulo')} data-testid="panel-revision">
      {movil ? (
        <>
          <span className="revision-resumen">
            <strong>{t('revision.tituloCorto')}</strong> ·{' '}
            <span data-testid="total-respuestas">{t('revision.respuestas', { count: lista.length })}</span> ·{' '}
            <span data-testid="avance-global">{t('revision.avanceGlobal', { completas: global.completas, total: global.total })}</span> ·{' '}
            {t('revision.codigo', { codigo: revisor })}
          </span>
          <button
            type="button"
            ref={botonAcciones}
            className="boton-acciones"
            aria-expanded={accionesAbiertas}
            aria-controls="acciones-revision"
            onClick={() => {
              if (!accionesAbiertas) abrir(null); // el menú y un diálogo no se muestran a la vez
              setAccionesAbiertas(!accionesAbiertas);
            }}
          >
            {t('revision.acciones')}
          </button>
          {accionesAbiertas && (
            <div id="acciones-revision" className="acciones-revision" data-testid="acciones-revision">
              <p className="recurso-nota">{t('revision.codigo', { codigo: revisor })}</p>
              {acciones}
              {notas}
              <button
                type="button"
                onClick={() => {
                  setAccionesAbiertas(false);
                  alSalir(botonAcciones.current);
                }}
              >
                {t('revision.salir')}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <span>
            <strong>{t('revision.titulo')}</strong> · {t('revision.codigo', { codigo: revisor })} ·{' '}
            <span data-testid="total-respuestas">{t('revision.respuestas', { count: lista.length })}</span> ·{' '}
            <span data-testid="avance-global">{t('revision.avanceGlobal', { completas: global.completas, total: global.total })}</span>
          </span>
          {acciones}
          {notas}
        </>
      )}
      <input
        ref={entradaRespaldo}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="entrada-respaldo"
        onChange={(e) => void cargarArchivo(e.currentTarget)}
      />
      {vista === 'que' && (
        <div className="dialogo-revision" role="dialog" aria-labelledby={ID_TITULO} data-testid="que-revisar">
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.queRevisarTitulo')}
          </h2>
          <p>{t('revision.queAyuda')}</p>
          {secciones.length ? (
            secciones.map((sec, i) => (
              <details key={sec.seccion} open={i === 0} className="seccion-revision" data-seccion={sec.seccion}>
                <summary>
                  {t(`revision.seccion_${sec.seccion}`)} ({sec.ids.length})
                </summary>
                <ul>
                  {sec.ids.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="enlace"
                        onClick={() => {
                          alElegir(id);
                          abrir(null); // el foco ya va al título de la ficha: no se devuelve a la barra
                        }}
                      >
                        {nombre(estructuras[id], idioma) || id}
                      </button>
                      {nombrePendiente(estructuras[id], idioma) && <span className="etiqueta-aviso"> {t('revision.nombrePendiente')}</span>}
                      <span className="recurso-nota" data-testid="avance-ficha">
                        {' '}
                        · {t('revision.avanceFicha', avanceDeFicha(id, respondidas, idioma, rutas))}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))
          ) : (
            <p>{t('revision.sinPendientes')}</p>
          )}
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
      {vista === 'como' && (
        <div className="dialogo-revision guia-revision" role="dialog" aria-labelledby={ID_TITULO} data-testid="como-revisar">
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.comoRevisar')}
          </h2>
          {(['intro', 'responder', 'idiomas', 'dudas', 'nombres', 'marcadores', 'trazos', 'recorridos', 'enviar', 'privacidad'] as const).map((k) => (
            <p key={k}>{t(`revision.guia.${k}`)}</p>
          ))}
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer" className="boton-primario enlace-boton">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
      {vista === 'enviar' && (
        <div className="dialogo-revision" role="dialog" aria-labelledby={ID_TITULO}>
          <h2 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dialogo-titulo">
            {t('revision.enviar')}
          </h2>
          <p>{t('revision.consentimiento')}</p>
          <p>
            <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer">
              {t('revision.guia.registrarme')}
            </a>
          </p>
          {!configurado && <p className="etiqueta-aviso">{t('revision.sinFormulario')}</p>}
          <ul>
            {[...porEstructura.entries()].map(([id, l]) => {
              const { completas, incompletas } = separarIncompletas(l);
              return (
                <li key={id}>
                  {nombre(estructuras[id], idioma) || id} · {t('revision.respuestas', { count: completas.length })}
                  {incompletas > 0 && (
                    <span className="etiqueta-aviso" data-testid="incompletas">
                      {' '}
                      {t('revision.incompletasNoSeEnvian', { count: incompletas })}
                    </span>
                  )}
                  {enviadas[id] && <span className="etiqueta-aviso"> {t('revision.enviadaEl', { fecha: enviadas[id]!.slice(0, 10) })}</span>}{' '}
                  <button type="button" disabled={completas.length === 0} onClick={() => void enviar(id, completas)}>
                    {configurado ? t('revision.abrirFormulario') : t('revision.copiar')}
                  </button>
                </li>
              );
            })}
          </ul>
          {partes && (
            <div role="group" aria-label={t('revision.largaExplica')}>
              <p>{t('revision.largaExplica')}</p>
              {partes.urls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="enlace-parte">
                  {t('revision.parte', { n: i + 1, total: partes.urls.length })}
                </a>
              ))}
            </div>
          )}
          {aviso && <p role="status">{aviso}</p>}
          <div className="dialogo-pie">
            <button type="button" onClick={() => cerrar(true)}>
              {t('comun.cerrar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
