// Página del atlas. La URL manda: /:lang/:slug selecciona una estructura (F11) y los parámetros
// de búsqueda reproducen una vista compartida.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { entradaPorSlug, estructuras, piezasDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { aplicarCortesEnlace, entradasDeCortes, leer, serializar } from '../lib/enlaces';
import { olvidarRevisor, pedirPersistencia, recordarRevisor, revisorRecordado } from '../lib/persistencia';
import { REVISOR_VALIDO } from '../lib/revision';
import { accionEscape, esCampoDeTexto } from '../lib/teclado';
import { useAtlas } from '../store/useAtlas';
import Arbol from './Arbol';
import AvisoPrimeraVisita from './Aviso';
import BarraFragmentar from './BarraFragmentar';
import BotonTema from './BotonTema';
import Buscador from './Buscador';
import ConfirmarSalida from './ConfirmarSalida';
import Ficha from './Ficha';
import GruposEstudio from './GruposEstudio';
import { IconoMarca, PalabraMarca } from './Marca';
import PanelMedicion from './PanelMedicion';
import LeyendaOrigen from './LeyendaOrigen';
import RecorridoVago from './RecorridoVago';
import PanelRevision from './PanelRevision';
import { useMovil } from './useMovil';
import Visor, { camaraActual } from './Visor';
import Vistas, { Metricas } from './Vistas';
import { IconoArbol, IconoBuscar, IconoCompartir, IconoGrupos } from './Iconos';

export default function Pagina({ slug, revision = false }: { slug?: string; revision?: boolean }) {
  const { lang } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const idioma: Idioma = lang === 'en' ? 'en' : 'es';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inicial = useMemo(() => leer(location.search), []); // solo la primera carga
  const codigoUrl = useMemo(() => new URLSearchParams(location.search).get('r'), [location.search]);
  // Un ?r= que no cumple el formato (también vacío) no activa el modo y se avisa; sin ?r= todo sigue igual.
  const enlaceInvalido = revision && codigoUrl !== null && !REVISOR_VALIDO.test(codigoUrl);
  const cargado = useAtlas((s) => s.cargado);
  const revisor = useAtlas((s) => s.revisor);
  const [menu, setMenu] = useState(false);
  const [seccion, setSeccion] = useState<'grupos' | 'arbol'>('arbol'); // qué muestra el cajón del riel
  const [paleta, setPaleta] = useState(false); // paleta de búsqueda (riel, lupa o Ctrl+K)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta(true);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);
  const [mensaje, setMensaje] = useState('');
  const movil = useMovil();
  // Salir del modo revisión pide confirmación; al cancelar el foco vuelve al botón que la abrió.
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const origenSalida = useRef<HTMLElement | null>(null);
  const pedirSalida = useCallback((origen: HTMLElement | null) => {
    origenSalida.current = origen;
    setConfirmarSalida(true);
  }, []);
  const cancelarSalida = useCallback(() => {
    setConfirmarSalida(false);
    const o = origenSalida.current;
    if (o?.isConnected) o.focus();
  }, []);
  const salirDeRevision = () => {
    setConfirmarSalida(false);
    useAtlas.getState().setRevisor(null);
    useAtlas.getState().cargarRespuestas({});
    useAtlas.getState().setUbicando(null);
    olvidarRevisor(); // el avance queda en IndexedDB; solo se olvida el código
  };
  const panel = useRef<HTMLElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const entrada = slug ? entradaPorSlug(slug, idioma) : undefined; // react-router ya decodificó el slug
  const noEncontrada = !!slug && !entrada;

  // Al abrir el cajón del celular el foco entra en él; cerrado, queda inerte (sin foco ni lector de pantalla).
  useEffect(() => {
    if (!menu || !movil) return;
    panel.current?.querySelector<HTMLElement>('button, input, select, a[href]')?.focus({ preventScroll: true });
  }, [menu, movil]);

  // Elegir un grupo de estudio cierra el cajón del celular; el foco vuelve al botón del menú (como con
  // Escape) en vez de quedar en BODY. Si el cajón no estaba abierto en celular, no se mueve el foco.
  // En pantallas anchas el cajón sigue abierto para comparar grupos; en celular se cierra para ver el modelo.
  const alElegirGrupo = useCallback(() => {
    if (!movil) return;
    const abiertoEnCelular = menu;
    setMenu(false);
    if (abiertoEnCelular) botonMenu.current?.focus();
  }, [movil, menu]);

  useEffect(() => {
    document.title = t('app.titulo');
  }, [t]);

  // Riel (modo estudio): cada botón abre el cajón en su sección; el mismo botón lo cierra.
  const abrirSeccion = (x: 'grupos' | 'arbol') => {
    if (menu && seccion === x) {
      setMenu(false);
      return;
    }
    setSeccion(x);
    setMenu(true);
    setTimeout(() => panel.current?.querySelector(x === 'grupos' ? '.grupos' : '.titulo-arbol')?.scrollIntoView({ block: 'start' }), 0);
  };

  // Estado inicial desde la URL compartida.
  useEffect(() => {
    const s = useAtlas.getState();
    if (inicial.nivel) s.setNivel(inicial.nivel);
    if (inicial.explosion) s.setExplosion(inicial.explosion / 100);
  }, [inicial]);

  // Cortes del enlace (`corte=`): una sola vez, cuando el modelo ya cargó y hay cajas para el rango.
  const cortesAplicados = useRef(false);
  useEffect(() => {
    if (!cargado || !inicial.corte || cortesAplicados.current) return;
    cortesAplicados.current = true;
    aplicarCortesEnlace(inicial.corte);
  }, [cargado, inicial]);

  // Modo revisión: el código llega en ?r= y, si cumple el formato, se recuerda en este navegador hasta
  // "Salir del modo revisión". Con un enlace inválido no se activa nada ni se toca el código recordado.
  useEffect(() => {
    if (enlaceInvalido) return;
    const codigo = (revision && codigoUrl) || revisorRecordado();
    if (codigo) {
      useAtlas.getState().setRevisor(codigo);
      recordarRevisor(codigo);
      void pedirPersistencia();
    }
  }, [revision, codigoUrl, enlaceInvalido]);

  // La URL decide la selección. El encuadre espera a que el modelo cargue (las cajas salen del GLB).
  // Un enlace compartido trae cámara y modo aislar: se respetan una sola vez, en la primera carga.
  const encuadrePendiente = useRef<string[] | null>(null);
  const respetarCamaraInicial = useRef(Boolean((inicial.vista || inicial.camara) && slug));
  const aislarInicial = useRef(inicial.aislar ?? null);
  const encuadrar = useCallback(() => {
    const piezas = encuadrePendiente.current;
    if (!piezas || !useAtlas.getState().cargado) return;
    encuadrePendiente.current = null;
    if (respetarCamaraInicial.current) {
      respetarCamaraInicial.current = false;
      return;
    }
    if (piezas.length) setTimeout(() => useAtlas.getState().pedirCamara({ encuadrar: piezas }), 50);
  }, []);

  /** Resaltar (F3, F4): selecciona, deja el resto como fantasma (muchas estructuras son internas) y encuadra. */
  const resaltar = useCallback(
    (id: string) => {
      const s = useAtlas.getState();
      s.seleccionar({ entrada: id });
      // En el recorrido del vago la cámara y el fantasma los manda la parada: solo se abre la ficha.
      if (s.recorrido !== null) return;
      const piezas = piezasDeEntrada(id);
      if (piezas.length) {
        s.aislarPiezas(piezas, aislarInicial.current ?? 'contexto');
        aislarInicial.current = null;
      }
      encuadrePendiente.current = piezas;
      encuadrar();
    },
    [encuadrar],
  );

  const irA = useCallback(
    (id: string | null, desdeVisor = false) => {
      const e = id ? estructuras[id] : undefined;
      const ruta = e ? `/${idioma}/${encodeURIComponent(e.slug[idioma])}` : `/${idioma}`;
      // Elegir la misma estructura que ya está en la URL no cambia la ruta: se resalta de nuevo aquí.
      const misma = encodeURI(decodeURI(location.pathname)).endsWith(ruta);
      // Búsqueda, árbol y relaciones llevan el foco a la ficha; un toque en el visor no.
      useAtlas.getState().pedirFocoFicha(id && !desdeVisor ? id : null);
      if (misma && desdeVisor) return; // el toque en el visor ya dejó la selección como está
      if (id && misma) resaltar(id);
      else if (!misma) navigate(ruta);
      setMenu(false);
    },
    [idioma, navigate, location.pathname, resaltar],
  );

  useEffect(() => {
    const s = useAtlas.getState();
    if (!entrada) {
      if (!slug) s.deseleccionar(); // sin estructura en la URL tampoco queda el resto como fantasma
      return;
    }
    if (s.seleccion.entrada === entrada) return; // vino del visor o del árbol: ya está resaltada
    resaltar(entrada);
  }, [entrada, slug, resaltar]);

  useEffect(() => {
    if (cargado) encuadrar();
  }, [cargado, encuadrar]);

  useEffect(() => {
    const alSeleccionar = (e: Event) => {
      const id = (e as CustomEvent<{ entrada: string | null }>).detail.entrada;
      const st = useAtlas.getState();
      if (!id && st.aislar?.modo === 'contexto' && st.recorrido === null) st.salirAislar();
      irA(id, true);
    };
    const alElegir = (e: Event) => irA((e as CustomEvent<{ entrada: string }>).detail.entrada);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useAtlas.getState();
      const accion = accionEscape({
        confirmandoSalida: confirmarSalida,
        dialogoRevision: s.dialogoRevision,
        menuAbierto: menu,
        ubicando: !!s.ubicando,
        aislado: !!s.aislar,
        enCampo: esCampoDeTexto(e.target as HTMLElement | null),
      });
      if (accion === 'cancelar-salida') cancelarSalida();
      else if (accion === 'cerrar-revision') window.dispatchEvent(new CustomEvent('atlas:cerrar-revision'));
      else if (accion === 'cerrar-menu') {
        setMenu(false);
        botonMenu.current?.focus();
      } else if (accion === 'cancelar-ubicar') s.setUbicando(null);
      else if (accion === 'salir-aislar') s.salirAislar();
    };
    window.addEventListener('atlas:seleccion', alSeleccionar);
    window.addEventListener('atlas:elegir', alElegir);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('atlas:seleccion', alSeleccionar);
      window.removeEventListener('atlas:elegir', alElegir);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [irA, menu, confirmarSalida, cancelarSalida]);

  const compartir = useCallback(async () => {
    const s = useAtlas.getState();
    const e = s.seleccion.entrada ? estructuras[s.seleccion.entrada] : undefined;
    const ruta = `${import.meta.env.BASE_URL}${idioma}${e ? `/${encodeURIComponent(e.slug[idioma])}` : ''}`;
    const consulta = serializar({
      camara: camaraActual.leer?.(),
      aislar: s.aislar?.modo,
      explosion: s.explosion * 100,
      nivel: s.nivel,
      corte: entradasDeCortes(s.cortes),
    });
    const url = `${window.location.origin}${ruta}${consulta}`;
    try {
      await navigator.clipboard.writeText(url);
      setMensaje(t('compartir.copiado'));
    } catch {
      setMensaje(url);
    }
    setTimeout(() => setMensaje(''), 4000);
  }, [idioma, t]);

  if (lang !== 'es' && lang !== 'en') return <Navigate to="/es" replace />;

  const otro: Idioma = idioma === 'es' ? 'en' : 'es';
  const rutaOtro = entrada ? `/${otro}/${encodeURIComponent(estructuras[entrada]!.slug[otro])}` : `/${otro}`;

  return (
    <div
      className={`app${menu ? ' menu-abierto' : ''}${revisor ? ' con-revision' : ''}${entrada ? ' con-ficha' : ''}`}
    >
      <header className="encabezado">
        <button ref={botonMenu} type="button" className="boton-menu" aria-expanded={menu} aria-controls="panel-izq" onClick={() => setMenu(!menu)}>
          {t('menu.boton')}
        </button>
        <Link to={`/${idioma}`} className="marca">
          <IconoMarca className="marca-icono" />
          <PalabraMarca className="marca-palabra" />
          <span className="solo-lector">{t('app.marca')}</span>
        </Link>
        <button type="button" className="boton-buscar" aria-label={t('riel.buscar')} title={t('riel.buscar')} onClick={() => setPaleta(true)}>
          <IconoBuscar />
        </button>
        <span className="espacio" />
        {/* Siempre ES y luego EN, con el activo relleno: se distingue por color, forma y orden fijo. */}
        <nav aria-label={t('idioma.selector')} className="selector-idioma">
          {(['es', 'en'] as const).map((i) =>
            i === idioma ? (
              <span key={i} className="idioma-actual" aria-current="true" lang={i} title={t('idioma.actual', { idioma: t(`idioma.${i}`) })} data-testid="idioma-actual">
                {i.toUpperCase()}
              </span>
            ) : (
              <Link key={i} to={rutaOtro} hrefLang={i} lang={i} title={t(`idioma.${i}`)} data-testid="cambiar-idioma">
                {i.toUpperCase()}
              </Link>
            ),
          )}
        </nav>
        <BotonTema />
        <button type="button" className="compartir-encabezado" onClick={() => void compartir()}>
          <span className="compartir-largo">{t('compartir.vista')}</span>
          {/* En celular solo el ícono, para que el encabezado quepa en una línea. */}
          <span className="compartir-corto">
            <IconoCompartir />
            <span className="solo-lector">{t('compartir.corto')}</span>
          </span>
        </button>
        {revisor && !movil && (
          <button type="button" onClick={(e) => pedirSalida(e.currentTarget)}>
            {t('revision.salir')}
          </button>
        )}
      </header>
      {noEncontrada && (
        <p className="mensaje mensaje-aviso" role="alert" data-testid="no-encontrada">
          {t('ruta.noEncontrada')} <Link to={`/${idioma}`}>{t('ruta.volver')}</Link>
        </p>
      )}
      {enlaceInvalido && (
        <p className="mensaje mensaje-aviso" role="alert" data-testid="enlace-invalido">
          {t('revision.enlaceInvalido')}
        </p>
      )}
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}
      {/* un panel por código: `cargadoDe` y el estado de envío nunca pasan de un ingreso a otro */}
      <PanelRevision key={revisor ?? ''} idioma={idioma} alElegir={irA} alSalir={pedirSalida} />
      <div className="cuerpo">
        <nav className="riel" aria-label={t('riel.titulo')}>
          <button
            type="button"
            className={menu && seccion === 'arbol' ? 'activo' : undefined}
            aria-expanded={menu && seccion === 'arbol'}
            aria-controls="panel-izq"
            onClick={() => abrirSeccion('arbol')}
          >
            <IconoArbol />
            <span>{t('riel.estructuras')}</span>
          </button>
          <button
            type="button"
            className={menu && seccion === 'grupos' ? 'activo' : undefined}
            aria-expanded={menu && seccion === 'grupos'}
            aria-controls="panel-izq"
            onClick={() => abrirSeccion('grupos')}
          >
            <IconoGrupos />
            <span>{t('riel.grupos')}</span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={() => setPaleta(true)}>
            <IconoBuscar />
            <span>{t('riel.buscar')}</span>
          </button>
        </nav>
        <aside id="panel-izq" ref={panel} className="panel-izq" inert={!menu}>
          <GruposEstudio idioma={idioma} alElegir={alElegirGrupo} />
          <h2 className="titulo-arbol">{t('arbol.titulo')}</h2>
          <Arbol idioma={idioma} alElegir={irA} />
        </aside>
        <main
          className="centro"
          onPointerDown={() => {
            if (menu) setMenu(false); // tocar el modelo cierra el cajón
          }}
        >
          <Metricas />
          <Visor idioma={idioma} vistaInicial={inicial.vista} camaraInicial={inicial.camara} />
          <BarraFragmentar />
          <Vistas />
          <LeyendaOrigen />
        </main>
        <Ficha
          idioma={idioma}
          alCompartir={() => void compartir()}
          alCerrar={() => {
            const s = useAtlas.getState();
            if (s.aislar?.modo === 'contexto' && s.recorrido === null) s.salirAislar();
            irA(null);
          }}
        />
      </div>
      <footer className="pie">
        <span>{t('aviso.educativo')}</span>{' '}
        <Link to={`/${idioma}/licencia`}>{t('licencia.enlace')}</Link>
      </footer>
      {paleta && (
        <div className="paleta-fondo" onMouseDown={(e) => e.target === e.currentTarget && setPaleta(false)}>
          <div className="paleta" role="dialog" aria-modal="true" aria-label={t('buscar.etiqueta')}>
            <Buscador idioma={idioma} alElegir={irA} alCerrar={() => setPaleta(false)} />
            <p className="paleta-ayuda">{t('buscar.ayudaPaleta')}</p>
          </div>
        </div>
      )}
      {revisor && confirmarSalida && <ConfirmarSalida alConfirmar={salirDeRevision} alCancelar={cancelarSalida} />}
      <RecorridoVago idioma={idioma} />
      <PanelMedicion />
      <AvisoPrimeraVisita />
    </div>
  );
}
