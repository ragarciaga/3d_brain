// Página del atlas. La URL manda: /:lang/:slug selecciona una estructura (F11) y los parámetros
// de búsqueda reproducen una vista compartida.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { entradaPorSlug, estructuras, piezasDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { leer, serializar } from '../lib/enlaces';
import { accionEscape, esCampoDeTexto } from '../lib/teclado';
import { useAtlas } from '../store/useAtlas';
import Arbol from './Arbol';
import AvisoPrimeraVisita from './Aviso';
import BarraFragmentar from './BarraFragmentar';
import BotonTema from './BotonTema';
import Buscador from './Buscador';
import Ficha from './Ficha';
import GruposEstudio from './GruposEstudio';
import PanelRevision from './PanelRevision';
import { useMovil } from './useMovil';
import Visor, { camaraActual } from './Visor';
import Vistas from './Vistas';

const CLAVE_REVISOR = 'atlas:revisor';

function leerRevisorGuardado(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_REVISOR);
  } catch {
    return null;
  }
}

export default function Pagina({ slug, revision = false }: { slug?: string; revision?: boolean }) {
  const { lang } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const idioma: Idioma = lang === 'en' ? 'en' : 'es';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inicial = useMemo(() => leer(location.search), []); // solo la primera carga
  const codigoUrl = useMemo(() => new URLSearchParams(location.search).get('r'), [location.search]);
  const cargado = useAtlas((s) => s.cargado);
  const ambos = useAtlas((s) => s.ambos);
  const revisor = useAtlas((s) => s.revisor);
  const [menu, setMenu] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const movil = useMovil();
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
  const alElegirGrupo = useCallback(() => {
    const abiertoEnCelular = movil && menu;
    setMenu(false);
    if (abiertoEnCelular) botonMenu.current?.focus();
  }, [movil, menu]);

  useEffect(() => {
    document.title = t('app.titulo');
  }, [t]);

  // Estado inicial desde la URL compartida.
  useEffect(() => {
    const s = useAtlas.getState();
    if (inicial.ambos) s.setAmbos(true);
    if (inicial.nivel) s.setNivel(inicial.nivel);
    if (inicial.explosion) s.setExplosion(inicial.explosion / 100);
  }, [inicial]);

  // Modo revisión: el código llega en ?r= y se conserva mientras dure la sesión del navegador.
  useEffect(() => {
    const codigo = (revision && codigoUrl) || leerRevisorGuardado();
    if (codigo) {
      useAtlas.getState().setRevisor(codigo);
      try {
        sessionStorage.setItem(CLAVE_REVISOR, codigo);
      } catch {
        /* sin almacenamiento de sesión: el modo dura hasta recargar */
      }
    }
  }, [revision, codigoUrl]);

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
      if (!id && useAtlas.getState().aislar?.modo === 'contexto') useAtlas.getState().salirAislar();
      irA(id, true);
    };
    const alElegir = (e: Event) => irA((e as CustomEvent<{ entrada: string }>).detail.entrada);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useAtlas.getState();
      const accion = accionEscape({
        menuAbierto: menu,
        ubicando: !!s.ubicando,
        aislado: !!s.aislar,
        enCampo: esCampoDeTexto(e.target as HTMLElement | null),
      });
      if (accion === 'cerrar-menu') {
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
  }, [irA, menu]);

  const compartir = useCallback(async () => {
    const s = useAtlas.getState();
    const e = s.seleccion.entrada ? estructuras[s.seleccion.entrada] : undefined;
    const ruta = `${import.meta.env.BASE_URL}${idioma}${e ? `/${encodeURIComponent(e.slug[idioma])}` : ''}`;
    const consulta = serializar({
      camara: camaraActual.leer?.(),
      aislar: s.aislar?.modo,
      explosion: s.explosion * 100,
      nivel: s.nivel,
      ambos: s.ambos,
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
    <div className={`app${menu ? ' menu-abierto' : ''}${revisor ? ' con-revision' : ''}`}>
      <header className="encabezado">
        <button ref={botonMenu} type="button" className="boton-menu" aria-expanded={menu} aria-controls="panel-izq" onClick={() => setMenu(!menu)}>
          {t('menu.boton')}
        </button>
        <Link to={`/${idioma}`} className="marca">
          {t('app.marca')}
        </Link>
        <Buscador idioma={idioma} alElegir={irA} />
        <label className="interruptor">
          <input type="checkbox" checked={ambos} onChange={(e) => useAtlas.getState().setAmbos(e.target.checked)} />{' '}
          {t('idioma.ambos')}
        </label>
        <nav aria-label={t('idioma.selector')} className="selector-idioma">
          <span aria-current="true">{idioma.toUpperCase()}</span>
          <Link to={rutaOtro} hrefLang={otro} lang={otro} data-testid="cambiar-idioma">
            {otro.toUpperCase()}
          </Link>
        </nav>
        <BotonTema />
        <button type="button" className="compartir-encabezado" onClick={() => void compartir()}>
          <span className="compartir-largo">{t('compartir.vista')}</span>
          <span className="compartir-corto">{t('compartir.corto')}</span>
        </button>
        {revisor && (
          <button
            type="button"
            onClick={() => {
              useAtlas.getState().setRevisor(null);
              useAtlas.getState().cargarRespuestas({});
              useAtlas.getState().setUbicando(null);
              try {
                sessionStorage.removeItem(CLAVE_REVISOR);
              } catch {
                /* nada que borrar */
              }
            }}
          >
            {t('revision.salir')}
          </button>
        )}
      </header>
      {noEncontrada && (
        <p className="mensaje mensaje-aviso" role="alert" data-testid="no-encontrada">
          {t('ruta.noEncontrada')} <Link to={`/${idioma}`}>{t('ruta.volver')}</Link>
        </p>
      )}
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}
      <PanelRevision idioma={idioma} alElegir={irA} />
      <div className="cuerpo">
        <aside id="panel-izq" ref={panel} className="panel-izq" inert={movil && !menu}>
          <GruposEstudio idioma={idioma} alElegir={alElegirGrupo} />
          <h2 className="titulo-arbol">{t('arbol.titulo')}</h2>
          <Arbol idioma={idioma} alElegir={irA} />
        </aside>
        <main className="centro">
          <Vistas />
          <Visor idioma={idioma} vistaInicial={inicial.vista} camaraInicial={inicial.camara} />
        </main>
        <Ficha
          idioma={idioma}
          alCompartir={() => void compartir()}
          alCerrar={() => {
            if (useAtlas.getState().aislar?.modo === 'contexto') useAtlas.getState().salirAislar();
            irA(null);
          }}
        />
      </div>
      <BarraFragmentar />
      <footer className="pie">
        <span>{t('aviso.educativo')}</span>{' '}
        <Link to={`/${idioma}/licencia`}>{t('licencia.enlace')}</Link>
      </footer>
      <AvisoPrimeraVisita />
    </div>
  );
}
