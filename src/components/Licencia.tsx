// Pantalla "Fuentes y licencia" (SPEC sección 13).
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Idioma } from '../data/tipos';
import { rutaPrivacidad } from '../lib/paginas';

export default function Licencia() {
  const { t } = useTranslation();
  const { lang = 'es' } = useParams();
  const idioma: Idioma = lang === 'en' ? 'en' : 'es';
  return (
    <main className="pagina-texto" data-testid="licencia">
      <h1>{t('licencia.titulo')}</h1>
      <h2>{t('licencia.modeloTitulo')}</h2>
      <p>{t('licencia.modelo')}</p>
      <ul>
        <li>
          <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noopener noreferrer">
            Z-Anatomy
          </a>{' '}
          (CC BY-SA 4.0)
        </li>
        <li>
          <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noopener noreferrer">
            BodyParts3D
          </a>
          , © The Database Center for Life Science (CC BY-SA 2.1 JP)
        </li>
        <li>{t('licencia.ta2')}</li>
      </ul>
      <p>{t('licencia.derivado')}</p>
      <h2>{t('licencia.contenidoTitulo')}</h2>
      <p>{t('licencia.contenido')}</p>
      <h2>{t('licencia.codigoTitulo')}</h2>
      <p>{t('licencia.codigo')}</p>
      <h2>{t('licencia.avisosTitulo')}</h2>
      <p>{t('aviso.educativo')}</p>
      <p>{t('aviso.unCuerpo')}</p>
      <p>
        {t('licencia.analitica')} <Link to={rutaPrivacidad(idioma)}>{t('privacidad.leer')}</Link>
      </p>
      <p>
        <Link to={`/${lang}`}>{t('licencia.volver')}</Link>
      </p>
    </main>
  );
}
