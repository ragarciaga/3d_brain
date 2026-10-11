// Si el modelo no carga o no hay WebGL, solo falla el visor: el árbol, la búsqueda y las fichas siguen
// funcionando y el usuario puede reintentar sin recargar la página.
import { Component, Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

function MensajeVisor({ alReintentar }: { alReintentar: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="visor-error" role="alert" data-testid="visor-error">
      <p>{t('visor.error')}</p>
      <button type="button" className="boton-primario" onClick={alReintentar}>
        {t('visor.reintentar')}
      </button>
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** Se llama antes de volver a montar el visor (por ejemplo, para vaciar el caché del modelo). */
  alReintentar?: () => void;
}

export default class BarreraVisor extends Component<Props, { error: boolean; intento: number }> {
  state = { error: false, intento: 0 };

  static getDerivedStateFromError() {
    return { error: true };
  }

  reintentar = () => {
    this.props.alReintentar?.();
    this.setState((s) => ({ error: false, intento: s.intento + 1 }));
  };

  render() {
    if (this.state.error) return <MensajeVisor alReintentar={this.reintentar} />;
    return <Fragment key={this.state.intento}>{this.props.children}</Fragment>;
  }
}
