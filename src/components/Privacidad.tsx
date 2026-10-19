// Página "Privacidad" (SPEC sección 13, ADR 0012, 0015 y 0016, #168). Pública: nunca muestra alias ni códigos de revisor.
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Idioma } from '../data/tipos';

export default function Privacidad() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const idioma: Idioma = lang === 'en' ? 'en' : 'es';
  return (
    <main className="pagina-texto" data-testid="privacidad">
      <h1>{t('privacidad.titulo')}</h1>
      <p>{t('privacidad.intro')}</p>
      <p>{t('privacidad.actualizado')}</p>
      <h2>{t('privacidad.responsableTitulo')}</h2>
      <p>{t('privacidad.responsable')}</p>
      <h2>{t('privacidad.visitasTitulo')}</h2>
      <p>{t('privacidad.visitas')}</p>
      <p>{t('privacidad.alojamiento')}</p>
      <h2>{t('privacidad.revisionTitulo')}</h2>
      <p>{t('privacidad.revision')}</p>
      <p>{t('privacidad.respaldo')}</p>
      <p>{t('privacidad.publicacion')}</p>
      <h2>{t('privacidad.reportesTitulo')}</h2>
      <p>{t('privacidad.reportes')}</p>
      <h2>{t('privacidad.finalidadesTitulo')}</h2>
      <p>{t('privacidad.finalidades')}</p>
      <h2>{t('privacidad.baseTitulo')}</h2>
      <p>{t('privacidad.base')}</p>
      <h2>{t('privacidad.proveedoresTitulo')}</h2>
      <ul>
        <li>{t('privacidad.proveedorCloudflare')}</li>
        <li>{t('privacidad.proveedorGoogle')}</li>
        <li>{t('privacidad.proveedorGithub')}</li>
        <li>{t('privacidad.proveedorHostinger')}</li>
      </ul>
      <p>{t('privacidad.transferencia')}</p>
      <h2>{t('privacidad.conservacionTitulo')}</h2>
      <p>{t('privacidad.conservacionRevision')}</p>
      <p>{t('privacidad.conservacionReportes')}</p>
      <p>{t('privacidad.conservacionProveedores')}</p>
      <h2>{t('privacidad.derechosTitulo')}</h2>
      <p>{t('privacidad.derechos')}</p>
      <p>{t('privacidad.autoridad')}</p>
      <h2>{t('privacidad.cookiesTitulo')}</h2>
      <p>{t('privacidad.cookies')}</p>
      <p>
        <Link to={`/${idioma}`}>{t('privacidad.volver')}</Link>
      </p>
    </main>
  );
}
