import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import Licencia from './components/Licencia';
import Pagina from './components/Pagina';
import { idiomaDelNavegador } from './i18n';
import { useAtlas } from './store/useAtlas';
import './estilos.css';

/** Una sola ruta por idioma para que el visor no se vuelva a montar al cambiar de estructura. */
function Ruta() {
  const { '*': resto = '' } = useParams();
  if (resto === 'licencia') return <Licencia />;
  if (resto === 'revision') return <Pagina revision />;
  return <Pagina slug={resto || undefined} />;
}

// Acceso al estado solo en desarrollo, para las pruebas E2E.
if (import.meta.env.DEV) (window as unknown as { __atlas: typeof useAtlas }).__atlas = useAtlas;

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Navigate to={`/${idiomaDelNavegador()}`} replace />} />
        <Route path="/:lang/*" element={<Ruta />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
