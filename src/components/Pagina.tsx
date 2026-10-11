// Página del atlas. La URL manda: /:lang/:slug selecciona una estructura (F11) y los parámetros
// de búsqueda reproducen una vista compartida.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { entradaPorSlug, estructuras, piezasDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import i18n from '../i18n';
import { leer, serializar } from '../lib/enlaces';
import { useAtlas } from '../store/useAtlas';
import Arbol from './Arbol';
import AvisoPrimeraVisita from './Aviso';
import BarraFragmentar from './BarraFragmentar';
import Buscador from './Buscador';
import Ficha from './Ficha';
import GruposEstudio from './GruposEstudio';
import PanelRevision from './PanelRevision';
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
  const entrada = slug ? entradaPorSlug(decodeURIComponent(slug), idioma) : undefined;

  useEffect(() => {
    if (i18n.language !== idioma) void i18n.changeLanguage(idioma);
    document.documentElement.lang = idioma;
  }, [idioma]);

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

  const irA = useCallback(
    (id: string | null) => {
      const e = id ? estructuras[id] : undefined;
      navigate(e ? `/${idioma}/${encodeURIComponent(e.slug[idioma])}` : `/${idioma}`);
      setMenu(false);
    },
    [idioma, navigate],
  );

  // La URL decide la selección. El encuadre espera a que el modelo cargue (las cajas salen del GLB)
  // y respeta la cámara de un enlace compartido en la primera carga.
  const encuadrePendiente = useRef<string[] | null>(null);
  const respetarCamaraInicial = useRef(Boolean(inicial.vista || inicial.camara));
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

  useEffect(() => {
    const s = useAtlas.getState();
    if (!entrada) {
      if (!slug) s.seleccionar(null);
      return;
    }
    if (s.seleccion.entrada === entrada) return; // vino del visor o del árbol: ya está resaltada
    s.seleccionar({ entrada });
    const piezas = piezasDeEntrada(entrada);
    // Resaltar (F3, F4): muchas estructuras son internas, así que el resto queda como fantasma.
    if (piezas.length && !inicial.aislar) s.aislarPiezas(piezas, 'contexto');
    encuadrePendiente.current = piezas;
    encuadrar();
  }, [entrada, slug, inicial, encuadrar]);

  useEffect(() => {
    if (cargado) encuadrar();
  }, [cargado, encuadrar]);

  // Aislar compartido: se aplica a la estructura del enlace cuando el modelo cargó.
  useEffect(() => {
    if (cargado && inicial.aislar && entrada) {
      useAtlas.getState().aislarPiezas(piezasDeEntrada(entrada), inicial.aislar);
    }
  }, [cargado, inicial, entrada]);

  useEffect(() => {
    const alSeleccionar = (e: Event) => {
      const id = (e as CustomEvent<{ entrada: string | null }>).detail.entrada;
      if (id) irA(id);
    };
    const alElegir = (e: Event) => irA((e as CustomEvent<{ entrada: string }>).detail.entrada);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const s = useAtlas.getState();
        if (s.ubicando) s.setUbicando(null);
        else if (s.aislar) s.salirAislar();
      }
    };
    window.addEventListener('atlas:seleccion', alSeleccionar);
    window.addEventListener('atlas:elegir', alElegir);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('atlas:seleccion', alSeleccionar);
      window.removeEventListener('atlas:elegir', alElegir);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [irA]);

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
        <button type="button" className="boton-menu" aria-expanded={menu} aria-controls="panel-izq" onClick={() => setMenu(!menu)}>
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
        <button type="button" className="compartir-encabezado" onClick={() => void compartir()}>
          {t('compartir.vista')}
        </button>
        {revisor && (
          <button
            type="button"
            onClick={() => {
              useAtlas.getState().setRevisor(null);
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
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}
      <PanelRevision idioma={idioma} />
      <div className="cuerpo">
        <aside id="panel-izq" className="panel-izq">
          <GruposEstudio idioma={idioma} />
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
