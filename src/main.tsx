import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import BarreraErrores from './components/BarreraErrores';
import Licencia from './components/Licencia';
import Pagina from './components/Pagina';
import { configRevision } from './config/revision';
import { camaraActual, cortesVisor, marcadoresDePrueba } from './components/Visor';
import { alturaRecorte } from './components/recorte';
import i18n, { idiomaDelNavegador } from './i18n';
import { useAtlas } from './store/useAtlas';
import './estilos.css';
import { MARCA_INICIO_APP } from './lib/medicion';

performance.mark(MARCA_INICIO_APP);

/** Una sola ruta por idioma para que el visor no se vuelva a montar al cambiar de estructura. */
function Ruta() {
  const { lang, '*': resto = '' } = useParams();
  const idioma = lang === 'en' ? 'en' : 'es';
  // El idioma sale de la URL en todas las páginas (también al abrir /en/licencia directo).
  useEffect(() => {
    if (i18n.language !== idioma) void i18n.changeLanguage(idioma);
    document.documentElement.lang = idioma;
  }, [idioma]);
  if (lang !== 'es' && lang !== 'en') return <Navigate to="/es" replace />;
  if (resto === 'licencia') return <Licencia />;
  if (resto === 'revision') return <Pagina revision />;
  return <Pagina slug={resto || undefined} />;
}

// Acceso al estado, a la cámara y a la URL del canal de retorno solo en desarrollo, para las pruebas E2E.
if (import.meta.env.DEV) {
  const w = window as unknown as {
    __urlCanalInicial?: unknown;
    __fijarUrlCanal: (url: string) => void;
    __atlas: typeof useAtlas;
    __camara: typeof camaraActual;
    __recorte: typeof alturaRecorte;
    __marcadores: typeof marcadoresDePrueba;
    __cortes: {
      planosDe(pieza: string): number;
      fantasmas(): string[];
      cajasMundo(): Record<string, number[]>;
      rellenos(pieza?: string): number;
    };
    __puntoCorte(pieza: string, lado?: 'corte' | 'oculto'): { x: number; y: number } | null;
  };
  w.__atlas = useAtlas;
  w.__camara = camaraActual;
  w.__recorte = alturaRecorte;
  w.__marcadores = marcadoresDePrueba;
  w.__cortes = {
    planosDe: (p) => cortesVisor.planosDe?.(p) ?? 0,
    fantasmas: () => cortesVisor.fantasmas?.() ?? [],
    cajasMundo: () => cortesVisor.cajasMundo?.() ?? {},
    rellenos: (p) => cortesVisor.rellenos?.(p) ?? 0,
  };
  w.__puntoCorte = (p, lado) => cortesVisor.puntoCorte?.(p, lado) ?? null;
  // Costura del canal: `addInitScript` deja `__urlCanalInicial` antes de la primera carga ('' anula el canal);
  // `__fijarUrlCanal` la cambia después. Nunca se lee de la URL de la página ni del almacenamiento.
  w.__fijarUrlCanal = (url) => {
    configRevision.urlCanal = url;
  };
  if (typeof w.__urlCanalInicial === 'string') configRevision.urlCanal = w.__urlCanalInicial;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BarreraErrores>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${idiomaDelNavegador()}`} replace />} />
          <Route path="/:lang/*" element={<Ruta />} />
        </Routes>
      </BrowserRouter>
    </BarreraErrores>
  </StrictMode>,
);
