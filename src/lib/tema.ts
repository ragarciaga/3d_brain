// Tema claro u oscuro. Lo elige la persona con el botón del encabezado; si nunca lo ha elegido,
// sigue al sistema. La elección se guarda solo en este navegador (localStorage), no es un dato personal.
export type Tema = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'atlas:tema';

function leerGuardado(): Tema | null {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return v === 'claro' || v === 'oscuro' ? v : null;
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function delSistema(): Tema {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

/** Tema vigente: el elegido o, si no hay, el del sistema. */
export function temaInicial(): Tema {
  return leerGuardado() ?? delSistema();
}

export function aplicarTema(t: Tema): void {
  document.documentElement.dataset.tema = t;
}

export function elegirTema(t: Tema): void {
  aplicarTema(t);
  try {
    localStorage.setItem(CLAVE_TEMA, t);
  } catch {
    /* sin almacenamiento: el tema dura hasta recargar */
  }
}

/** Mientras la persona no elija, el tema sigue los cambios del sistema. Devuelve cómo dejar de escuchar. */
export function seguirSistema(alCambiar: (t: Tema) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const oir = () => {
    if (leerGuardado()) return;
    const t = delSistema();
    aplicarTema(t);
    alCambiar(t);
  };
  mq.addEventListener('change', oir);
  return () => mq.removeEventListener('change', oir);
}
