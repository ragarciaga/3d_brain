// Formularios de issue del reporte de error (F12, issue #234): .github/ISSUE_TEMPLATE/*.yml.
// Se leen como texto, sin parser YAML: el formato es fijo y la prueba lo exige. Lo que se prueba es el contrato
// con `PLANTILLA` y con los parámetros de `enlaceGithub`; que GitHub llene los campos y ponga la etiqueta
// es comportamiento de GitHub y se confirma a mano después de publicar (docs/operacion.md).
import { readdirSync, readFileSync } from 'node:fs';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { PLANTILLA, TIPOS } from '../src/config/reporte';
import { enlaceGithub, type Reporte } from '../src/lib/reporte';

const CARPETA = '.github/ISSUE_TEMPLATE';
const t = ((k: string) => k) as unknown as TFunction;
const IDS = ['estructura', 'idioma', 'version', 'parte', 'descripcion'];
const ETIQUETAS = ['reporte:contenido', 'reporte:traduccion', 'reporte:enlace-roto', 'reporte:pieza'];
const GUION_LARGO = '—';

const leer = (archivo: string) => readFileSync(`${CARPETA}/${archivo}`, 'utf8');

/** Primer grupo de `re` sobre `texto`, o falla con el nombre de lo que faltó. */
function valor(texto: string, re: RegExp, que: string): string {
  const m = re.exec(texto);
  expect(m, `falta ${que}`).not.toBeNull();
  return m![1]!;
}

/** Los ítems de `body`: el texto se parte en cada `  - type: `. */
function items(texto: string): string[] {
  return texto.split(/^ {2}- type: /m).slice(1);
}

/** Cada texto es `Español / English`: dos segmentos no vacíos. */
function bilingue(texto: string): string[] {
  return texto.split(' / ').map((s) => s.trim());
}

const reporte = (tipo: Reporte['tipo']): Reporte => ({
  tipo,
  estructura: 'e1',
  nombre: 'Nombre',
  idioma: 'es',
  version: 'v1',
  parte: 'general',
  descripcion: 'Falta una fuente.',
});

describe('plantillas de issue del reporte (R6.1, R6.2)', () => {
  it('hay exactamente un archivo por tipo, con los nombres de PLANTILLA', () => {
    const archivos = readdirSync(CARPETA).sort();
    expect(archivos).toEqual(Object.values(PLANTILLA).sort());
    expect(archivos).toHaveLength(TIPOS.length);
  });

  it('cada tipo pone su etiqueta reporte:<tipo>, y las cuatro son distintas', () => {
    const etiquetas = TIPOS.map((tipo) => {
      const texto = leer(PLANTILLA[tipo]);
      expect(valor(texto, /^labels: (\[.*\])$/m, `labels en ${PLANTILLA[tipo]}`)).toBe(`["reporte:${tipo}"]`);
      return `reporte:${tipo}`;
    });
    expect(etiquetas).toEqual(ETIQUETAS);
    expect(new Set(etiquetas).size).toBe(4);
  });

  it.each(TIPOS)('%s: cinco campos en orden, de los tipos esperados, y la descripción es obligatoria', (tipo) => {
    const lista = items(leer(PLANTILLA[tipo]));
    expect(lista).toHaveLength(5);
    expect(lista.map((i) => valor(i, /^ {4}id: (\S+)$/m, 'id'))).toEqual(IDS);
    expect(lista.map((i) => /^(\w+)\n/.exec(i)?.[1])).toEqual(['input', 'input', 'input', 'input', 'textarea']);
    lista.forEach((i, n) => {
      const obligatorio = /^ {4}validations:\n {6}required: true$/m.test(i);
      expect(obligatorio, `required en ${IDS[n]}`).toBe(IDS[n] === 'descripcion');
    });
  });

  it.each(TIPOS)('%s: los id son los parámetros de enlaceGithub y template es su archivo', (tipo) => {
    const url = new URL(enlaceGithub(reporte(tipo), t));
    const claves = [...url.searchParams.keys()].filter((k) => k !== 'template' && k !== 'title');
    const ids = items(leer(PLANTILLA[tipo])).map((i) => valor(i, /^ {4}id: (\S+)$/m, 'id'));
    expect(claves).toEqual(ids);
    expect(url.searchParams.get('template')).toBe(PLANTILLA[tipo]);
  });
});

describe('textos bilingües de las plantillas (R8.3)', () => {
  it.each(TIPOS)('%s: name, description y cada label y description de campo son "Español / English"', (tipo) => {
    const texto = leer(PLANTILLA[tipo]);
    const textos = [
      valor(texto, /^name: "(.+)"$/m, 'name'),
      valor(texto, /^description: "(.+)"$/m, 'description'),
      ...items(texto).flatMap((i) => [
        valor(i, /^ {6}label: "(.+)"$/m, 'label'),
        valor(i, /^ {6}description: "(.+)"$/m, 'description del campo'),
      ]),
    ];
    expect(textos).toHaveLength(12);
    for (const s of textos) {
      const partes = bilingue(s);
      expect(partes, s).toHaveLength(2);
      expect(partes.every((p) => p.length > 0), s).toBe(true);
    }
  });

  it('ningún archivo tiene el guion largo', () => {
    for (const tipo of TIPOS) expect(leer(PLANTILLA[tipo]).includes(GUION_LARGO), PLANTILLA[tipo]).toBe(false);
  });
});

describe('docs/operacion.md: etiquetas de los reportes (R6.3)', () => {
  const operacion = readFileSync('docs/operacion.md', 'utf8');
  const encabezado = '## Etiquetas de los reportes de error';

  it('la sección nombra las cuatro etiquetas, dice que ya existen y cómo recrearlas o editarlas', () => {
    const desde = operacion.indexOf(`\n${encabezado}\n`);
    expect(desde, 'falta la sección').toBeGreaterThan(-1);
    const resto = operacion.slice(desde + 1 + encabezado.length);
    const fin = resto.indexOf('\n## ');
    const seccion = fin === -1 ? resto : resto.slice(0, fin);
    for (const etiqueta of ETIQUETAS) expect(seccion, etiqueta).toContain(`\`${etiqueta}\``);
    expect(seccion).toContain('ya existen');
    expect(seccion).toContain('New label');
    expect(seccion).toContain('Edit');
  });
});
