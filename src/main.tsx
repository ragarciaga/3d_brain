import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import BarreraErrores from './components/BarreraErrores';
import Licencia from './components/Licencia';
import Pagina from './components/Pagina';
import { camaraActual } from './components/Visor';
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

// Acceso al estado y a la cámara solo en desarrollo, para las pruebas E2E.
if (import.meta.env.DEV) {
  const w = window as unknown as { __atlas: typeof useAtlas; __camara: typeof camaraActual };
  w.__atlas = useAtlas;
  w.__camara = camaraActual;
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
