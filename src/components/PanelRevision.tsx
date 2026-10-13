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
import { useAtlas } from '../store/useAtlas';

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

export default function PanelRevision({ idioma, alElegir }: { idioma: Idioma; alElegir: (id: string) => void }) {
  const { t } = useTranslation();
  const revisor = useAtlas((s) => s.revisor);
  const respuestas = useAtlas((s) => s.respuestas);
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
      .then((guardado: { respuestas?: Record<string, Respuesta>; confirmadas?: Record<string, string> } | undefined) => {
        if (!vigente) return;
        useAtlas.getState().cargarRespuestas(guardado?.respuestas ?? {});
        setConfirmadas(guardado?.confirmadas ?? {}); // el `enviadas` de versiones anteriores se ignora
        setEnvio(null);
      })
      .catch(() => undefined)
      .finally(() => vigente && setCargadoDe(revisor));
    return () => {
      vigente = false;
    };
  }, [revisor]);

  useEffect(() => {
    if (!revisor || cargadoDe !== revisor) return;
    set(claveIdb(revisor), { respuestas, confirmadas }).catch(() => undefined);
  }, [revisor, respuestas, confirmadas, cargadoDe]);

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

  // Al abrir un diálogo, el foco va a su título: así se anuncia y Escape queda a un toque.
  useEffect(() => {
    if (vista) titulo.current?.focus({ preventScroll: true });
  }, [vista]);

  // Escape (Pagina) cierra el diálogo antes que cualquier otra cosa.
  useEffect(() => {
    useAtlas.getState().setDialogoRevision(vista !== null);
    return () => useAtlas.getState().setDialogoRevision(false);
  }, [vista]);

  const cerrar = useCallback(
    (devolverFoco: boolean) => {
      if (!revisor) return;
      if (vista === 'como') marcarGuiaVista(revisor);
      setElegida('ninguna');
      // El botón de la barra ya está en pantalla: se enfoca antes de que el diálogo se desmonte.
      if (devolverFoco && vista) botones.current[vista]?.focus();
    },
    [revisor, vista],
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
  const pendientes = pendientesDeEnvio(lista, confirmadas);
  const clavesPendientes = new Set(pendientes.map(claveRespuesta));
  const hayCompletas = lista.some(respuestaCompleta);

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

  return (
    <div className="panel-revision" role="region" aria-label={t('revision.titulo')} data-testid="panel-revision">
      <span>
        <strong>{t('revision.titulo')}</strong> · {t('revision.codigo', { codigo: revisor })} ·{' '}
        <span data-testid="total-respuestas">{t('revision.respuestas', { count: lista.length })}</span> ·{' '}
        <span data-testid="avance-global">{t('revision.avanceGlobal', { completas: global.completas, total: global.total })}</span>
      </span>
      <button type="button" ref={(el) => { botones.current.que = el; }} aria-expanded={vista === 'que'} onClick={() => alternar('que')}>
        {t('revision.queRevisar', { count: totalPendientes })}
      </button>
      <button type="button" ref={(el) => { botones.current.como = el; }} aria-expanded={vista === 'como'} onClick={() => alternar('como')}>
        {t('revision.comoRevisar')}
      </button>
      <button
        type="button"
        ref={(el) => { botones.current.enviar = el; }}
        className="boton-primario"
        aria-expanded={vista === 'enviar'}
        onClick={() => alternar('enviar')}
      >
        {t('revision.enviar')}
      </button>
      {viejas.length > 0 && <span className="etiqueta-aviso">{t('revision.desactualizadas', { count: viejas.length })}</span>}
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
    </div>
  );
}
