import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Lee los archivos como texto, sin importarlos: index.html no es un módulo y Visor.tsx arrastra three.
const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const RUTA = 'modelos/atlas.glb';

describe('precarga del modelo 3D (issue 83)', () => {
  it('index.html precarga el modelo antes del código', () => {
    const html = leer('index.html');
    const enlaces = html.match(/<link\b[^>]*\brel="preload"[^>]*>/g) ?? [];
    expect(enlaces).toHaveLength(1);
    const enlace = enlaces[0]!;
    expect(enlace).toContain(`href="/${RUTA}"`);
    expect(enlace).toMatch(/\bas="fetch"/);
    expect(enlace).toMatch(/\bcrossorigin\b/);
    expect(enlace).not.toMatch(/\btype=/);
    const pos = html.indexOf(enlace);
    expect(pos).toBeGreaterThan(html.indexOf('<head>'));
    expect(pos).toBeLessThan(html.indexOf('</head>'));
    expect(pos).toBeLessThan(html.indexOf('<script type="module"'));
  });

  it('la precarga apunta al mismo archivo que el visor', () => {
    const visor = leer('src/components/Visor.tsx');
    expect(visor).toContain(`export const URL_MODELO = \`\${import.meta.env.BASE_URL}${RUTA}\``);
    expect(leer('index.html')).toContain(`href="/${RUTA}"`);
  });
});
