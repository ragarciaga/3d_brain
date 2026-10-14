// Modo revisión docente (F24): avance, fichas pendientes, envío por formulario de Google y autorización del canal de retorno.
import { get, set } from 'idb-keyval';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configRevision } from '../config/revision';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { autorizacionVigente, canalConfigurado, ErrorCanal, leer } from '../lib/canal';
import { nombre, nombrePendiente } from '../lib/nombres';
import { avanceDeFicha, avanceGlobal, ordenDeRevision } from '../lib/prioridad';
import {
  claveRespuesta,
  confirmarParte,
  desactualizadas,
  formularioConfigurado,
  partesEnvio,
  pendientesDeEnvio,
  respuestaCompleta,
  separarIncompletas,
  type EstadoParte,
  type ParteEnvio,
  type Respuesta,
} from '../lib/revision';
import { crearRespaldo, leerRespaldo, MAX_RESPALDO_CARACTERES, type ErrorRespaldo } from '../lib/respaldo';
import { useAtlas } from '../store/useAtlas';
import DialogoAutorizacion from './DialogoAutorizacion';
import SeccionTrazos from './SeccionTrazos';
import { useMovil } from './useMovil';

const claveIdb = (codigo: string) => `revision:${codigo}`;
const versionActual = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
const claveGuia = (codigo: string) => `atlas:guia-vista:${codigo}`;
type Vista = 'que' | 'como' | 'enviar' | null;
const ID_TITULO = 'dialogo-revision-titulo'; // solo hay un diálogo abierto a la vez
const idEstructuraValido = (id: unknown) => typeof id === 'string' && Object.hasOwn(estructuras, id);

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
  const autorizacion = useAtlas((s) => s.autorizacion);
  const lecturaCanal = useAtlas((s) => s.lecturaCanal);
  const [elegida, setElegida] = useState<Vista | 'ninguna'>(null);
  const rutas = useAtlas((s) => s.rutas);
  const [confirmadas, setConfirmadas] = useState<Record<string, string>>({});
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [envio, setEnvio] = useState<{ partes: ParteEnvio[]; estados: EstadoParte[] } | null>(null);

  useEffect(() => {
    if (!revisor) return;
    let vigente = true;
    get(claveIdb(revisor))
      .then(
        (
          guardado:
            | { respuestas?: Record<string, Respuesta>; confirmadas?: Record<string, string>; autorizacion?: unknown }
            | undefined,
        ) => {
          if (!vigente) return;
          useAtlas.getState().cargarRespuestas(guardado?.respuestas ?? {});
          setConfirmadas(guardado?.confirmadas ?? {}); // el `enviadas` de versiones anteriores se ignora
          useAtlas.getState().setAutorizacion(autorizacionVigente(guardado?.autorizacion)); // copia local: entrada no confiable
          setEnvio(null);
        },
      )
      .catch(() => undefined)
      .finally(() => {
        if (!vigente) return;
        setCargadoDe(revisor);
        if (!canalConfigurado()) return;
        // Lectura inicial del canal. Lo que devuelve `leer` manda sobre la copia local, también cuando es null.
        // Sus `respuestas` todavía no se usan: fusionarlas es de T8.
        leer(revisor, idEstructuraValido).then(
          ({ autorizacion }) => {
            if (!vigente) return;
            useAtlas.getState().setAutorizacion(autorizacion);
            useAtlas.getState().setLecturaCanal('hecha');
          },
          (e: unknown) => {
            if (!vigente) return;
            // Si falla, se queda la copia local de la autorización.
            useAtlas.getState().setLecturaCanal(e instanceof ErrorCanal && e.tipo === 'codigo_no_activo' ? 'inactivo' : 'fallida');
          },
        );
      });
    return () => {
      vigente = false;
    };
  }, [revisor]);

  useEffect(() => {
    if (!revisor || cargadoDe !== revisor) return;
    set(claveIdb(revisor), { respuestas, confirmadas, autorizacion }).catch(() => undefined);
  }, [revisor, respuestas, confirmadas, autorizacion, cargadoDe]);

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

  // Autorización (R2.1): se pide al haber algo por guardar, sin autorización vigente y con la lectura del canal
  // resuelta. Escape o "Cerrar" la descartan solo hasta el siguiente cambio de respuestas.
  const [descartadaCon, setDescartadaCon] = useState<Record<string, Respuesta> | null>(null);
  const hayPorGuardar = useMemo(() => pendientesDeEnvio(Object.values(respuestas), confirmadas).length > 0, [respuestas, confirmadas]);
  const pedirAutorizacion =
    !!revisor &&
    canalConfigurado() &&
    cargadoDe === revisor &&
    (lecturaCanal === 'hecha' || lecturaCanal === 'fallida') &&
    autorizacion === null &&
    hayPorGuardar &&
    descartadaCon !== respuestas;

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
    useAtlas.getState().setDialogoRevision(vista !== null || pedirAutorizacion);
    return () => useAtlas.getState().setDialogoRevision(false);
  }, [vista, pedirAutorizacion]);

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
    // La autorización es modal y va primero: Escape la cierra sin aceptar (el foco lo devuelve el diálogo al desmontarse).
    const alCerrar = () => (pedirAutorizacion ? setDescartadaCon(respuestas) : cerrar(true));
    window.addEventListener('atlas:cerrar-revision', alCerrar);
    return () => window.removeEventListener('atlas:cerrar-revision', alCerrar);
  }, [cerrar, pedirAutorizacion, respuestas]);

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
  const pendientes = pendientesDeEnvio(lista, confirmadas);
  const clavesPendientes = new Set(pendientes.map(claveRespuesta));
  const hayCompletas = lista.some(respuestaCompleta);
  // Igual que la lista de fichas: cierra el diálogo sin devolver el foco a la barra.
  const trazosUI = <SeccionTrazos alAbrir={() => abrir(null)} />;

  const copiarODescargar = async (carga: string, archivo: string) => {
    try {
      await navigator.clipboard.writeText(carga);
      setAviso(t('revision.copiada'));
    } catch {
      const url = URL.createObjectURL(new Blob([carga], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = archivo;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso(t('revision.descargada'));
    }
  };

  // No abre nada solo: cada parte se abre con su propio enlace y solo se confirma a mano.
  const enviarTodo = () => {
    const partes = partesEnvio(configRevision, revisor, pendientes);
    setEnvio({ partes, estados: partes.map((): EstadoParte => 'sin_abrir') });
  };

  const marcar = (i: number, estado: EstadoParte) =>
    setEnvio((e) =>
      e && { ...e, estados: e.estados.map((x, k) => (k === i && x !== 'confirmada' ? estado : x)) },
    );

  const confirmar = (i: number) => {
    const parte = envio?.partes[i];
    if (!parte) return;
    marcar(i, 'confirmada');
    setConfirmadas((c) => confirmarParte(c, parte));
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
    const l = leerRespaldo(texto, { revisor, idOk: idEstructuraValido });
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
          {!secciones.some((sec) => sec.seccion === 'dudas') && trazosUI}
          {secciones.length ? (
            secciones.map((sec, i) => (
              <Fragment key={sec.seccion}>
                <details open={i === 0} className="seccion-revision" data-seccion={sec.seccion}>
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
                {sec.seccion === 'dudas' && trazosUI}
              </Fragment>
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
          {/* Con el canal configurado el registro previo (nombre, rol) ya no existe: R2.6 pide no mostrarlo.
              La reescritura completa de la guía es de T12. */}
          {(
            [
              'intro',
              'responder',
              'idiomas',
              'dudas',
              'nombres',
              'marcadores',
              'trazos',
              'recorridos',
              'enviar',
              ...(canalConfigurado() ? [] : (['privacidad'] as const)),
            ] as const
          ).map((k) => (
            <p key={k}>{t(`revision.guia.${k}`)}</p>
          ))}
          {!canalConfigurado() && (
            <p>
              <a href={configRevision.urlRegistro} target="_blank" rel="noopener noreferrer" className="boton-primario enlace-boton">
                {t('revision.guia.registrarme')}
              </a>
            </p>
          )}
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
          <p data-testid="pendientes-envio">
            {pendientes.length > 0
              ? t('revision.pendientesEnvio', { count: pendientes.length })
              : hayCompletas
                ? t('revision.todoEnviado')
                : t('revision.nadaPorEnviar')}
          </p>
          <ul>
            {[...porEstructura.entries()].map(([id, l]) => {
              const { completas, incompletas } = separarIncompletas(l);
              const sinEnviar = completas.filter((r) => clavesPendientes.has(claveRespuesta(r))).length;
              return (
                <li key={id}>
                  {nombre(estructuras[id], idioma) || id} · {t('revision.respuestas', { count: completas.length })}
                  {incompletas > 0 && (
                    <span className="etiqueta-aviso" data-testid="incompletas">
                      {' '}
                      {t('revision.incompletasNoSeEnvian', { count: incompletas })}
                    </span>
                  )}
                  {sinEnviar > 0 && <span data-testid="sin-enviar"> · {t('revision.sinEnviar', { count: sinEnviar })}</span>}
                </li>
              );
            })}
          </ul>
          <button type="button" className="boton-primario" disabled={pendientes.length === 0} onClick={enviarTodo}>
            {t('revision.enviarTodo')}
          </button>
          {envio && envio.partes.length > 0 && (
            <div>
              <p>{t('revision.confirmaAyuda')}</p>
              {envio.partes.length > 1 && <p>{t('revision.largaExplica')}</p>}
              <ul data-testid="partes-envio">
                {envio.partes.map((parte, i) => {
                  const estado = envio.estados[i] ?? 'sin_abrir';
                  return (
                    <li key={i} data-testid="parte-envio" data-estado={estado}>
                      {t('revision.parte', { n: i + 1, total: envio.partes.length })} ·{' '}
                      {t('revision.respuestas', { count: parte.respuestas.length })} ·{' '}
                      <span className="etiqueta-aviso">
                        {estado === 'confirmada'
                          ? t('revision.parteConfirmada')
                          : estado === 'abierta'
                            ? t('revision.parteAbierta')
                            : t('revision.parteSinAbrir')}
                      </span>{' '}
                      {estado !== 'confirmada' && parte.url && (
                        <a href={parte.url} target="_blank" rel="noopener noreferrer" className="enlace-parte" onClick={() => marcar(i, 'abierta')}>
                          {t('revision.abrirFormulario')}
                        </a>
                      )}
                      {estado !== 'confirmada' && !parte.url && (
                        <button
                          type="button"
                          onClick={async () => {
                            await copiarODescargar(parte.carga, `revision-${revisor}-parte-${i + 1}.json`);
                            marcar(i, 'abierta');
                          }}
                        >
                          {t('revision.copiar')}
                        </button>
                      )}{' '}
                      {estado === 'abierta' && (
                        <button type="button" onClick={() => confirmar(i)}>
                          {t('revision.loEnvie')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
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
      {pedirAutorizacion && (
        <DialogoAutorizacion alAceptar={(vago) => useAtlas.getState().cambiarAutorizacion(vago)} alCerrar={() => setDescartadaCon(respuestas)} />
      )}
    </div>
  );
}
