// Paneles laterales plegables en pantallas anchas: árbol (izquierda) y ficha (derecha). La preferencia
// se guarda solo en este navegador; en celular los paneles son cajón y hoja, y esto no aplica.
export interface Paneles {
  izq: boolean; // visible
  der: boolean;
}

export const CLAVE_PANELES = 'atlas:paneles';
const POR_DEFECTO: Paneles = { izq: true, der: true };

export function leerPaneles(): Paneles {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PANELES) ?? 'null') as Partial<Paneles> | null;
    if (!v || typeof v !== 'object') return POR_DEFECTO;
    return { izq: v.izq !== false, der: v.der !== false };
  } catch {
    return POR_DEFECTO; // sin almacenamiento o con un valor dañado
  }
}

export function guardarPaneles(p: Paneles): void {
  try {
    localStorage.setItem(CLAVE_PANELES, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
}
