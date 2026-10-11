// Si algo falla al dibujar, se muestra un mensaje traducido en vez de una página en blanco.
import { Component, type ReactNode } from 'react';
import i18n from '../i18n';

export default class BarreraErrores extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = i18n.t.bind(i18n);
    const inicio = `${import.meta.env.BASE_URL}${i18n.language === 'en' ? 'en' : 'es'}`;
    return (
      <main className="pagina-texto" role="alert">
        <h1>{t('error.titulo')}</h1>
        <p>{t('error.texto')}</p>
        <p>
          <a href={inicio}>{t('error.volver')}</a>
        </p>
      </main>
    );
  }
}
