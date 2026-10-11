// Paridad de claves entre idiomas (F10): ningún texto de interfaz queda sin traducir.
type Arbol = { [k: string]: string | Arbol };

export function aplanar(o: Arbol, prefijo = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefijo}${k}`] : aplanar(v, `${prefijo}${k}.`),
  );
}

export function diferencias(a: Arbol, b: Arbol): { soloA: string[]; soloB: string[]; vacias: string[] } {
  const ka = new Set(aplanar(a));
  const kb = new Set(aplanar(b));
  const vacias: string[] = [];
  const revisar = (o: Arbol, p = '') => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        if (!v.trim()) vacias.push(`${p}${k}`);
      } else revisar(v, `${p}${k}.`);
    }
  };
  revisar(a);
  revisar(b);
  return { soloA: [...ka].filter((k) => !kb.has(k)), soloB: [...kb].filter((k) => !ka.has(k)), vacias };
}

/** Claves literales usadas con t('...') en el código que no existen en el diccionario. */
export function clavesFaltantes(codigo: string, dic: Arbol): string[] {
  const claves = new Set(aplanar(dic));
  const usadas = new Set<string>();
  for (const m of codigo.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) usadas.add(m[1]!);
  return [...usadas].filter((k) => !claves.has(k) && !claves.has(`${k}_one`) && !claves.has(`${k}_other`));
}
