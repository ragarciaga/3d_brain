// Botón del encabezado para pasar de tema claro a oscuro y al revés.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { elegirTema, seguirSistema, temaInicial, type Tema } from '../lib/tema';

export default function BotonTema() {
  const { t } = useTranslation();
  const [tema, setTema] = useState<Tema>(temaInicial);
  useEffect(() => seguirSistema(setTema), []);
  const otro: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';
  return (
    <button
      type="button"
      className="boton-tema"
      data-testid="boton-tema"
      aria-label={t(otro === 'oscuro' ? 'tema.aOscuro' : 'tema.aClaro')}
      title={t(otro === 'oscuro' ? 'tema.aOscuro' : 'tema.aClaro')}
      onClick={() => {
        elegirTema(otro);
        setTema(otro);
      }}
    >
      <span aria-hidden="true">{tema === 'oscuro' ? '☀' : '☾'}</span>
    </button>
  );
}
