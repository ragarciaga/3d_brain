// Íconos del riel (modo estudio). Trazos simples con el color del texto (currentColor).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Árbol de estructuras: una raíz con ramas. */
export function IconoArbol() {
  return (
    <svg {...base}>
      <circle cx="6" cy="5" r="2" />
      <path d="M6 7v12M6 12h6M6 19h6" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="15" cy="19" r="2" />
    </svg>
  );
}

/** Grupos de estudio: tres círculos que se cruzan. */
export function IconoGrupos() {
  return (
    <svg {...base}>
      <circle cx="9" cy="9" r="5" />
      <circle cx="15" cy="9" r="5" />
      <circle cx="12" cy="15" r="5" />
    </svg>
  );
}

/** Compartir: tres nodos unidos. */
export function IconoCompartir() {
  return (
    <svg {...base}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}

/** Lupa. */
export function IconoBuscar() {
  return (
    <svg {...base}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}
