// Textos del canal después de cerrar el GET de lectura y fijar la versión de la autorización (#169, #166):
// la guía del editor, el diseño de la spec 03, el ADR 0012 y los comentarios del script y del cliente.
// Lo que prueba es el texto; que el script haga lo que dicen lo prueba tests/apps-script.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

const guia = leer('docs/revision-docente.md');
const diseno = leer('docs/specs/03-review-return-channel/design.md');
const adr = leer('docs/adr/0012-apps-script-canal-revision.md');

/** Líneas desde la primera que cumple `inicio` hasta la siguiente `## ` (o el final). */
function tramo(texto: string, inicio: RegExp): string {
  const lineas = texto.split('\n');
  const desde = lineas.findIndex((l) => inicio.test(l));
  expect(desde, `no hay una línea que cumpla ${String(inicio)}`).toBeGreaterThan(-1);
  const hasta = lineas.findIndex((l, i) => i > desde && /^##\s/.test(l));
  return lineas.slice(desde, hasta === -1 ? undefined : hasta).join('\n');
}

describe('la prueba rápida del paso 7 de la guía (D9)', () => {
  const desde = guia.split('\n').findIndex((l) => l.startsWith('7. Prueba rápida'));
  const hasta = guia.split('\n').findIndex((l) => l.startsWith('Para actualizar el script'));
  const paso = guia.split('\n').slice(desde, hasta).join('\n');
  const bloques = [...paso.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
  const bloque = bloques.find((b) => b.includes('Invoke-RestMethod'));

  it('el paso 7 existe y termina antes de la actualización del script', () => {
    expect(desde).toBeGreaterThan(-1);
    expect(hasta).toBeGreaterThan(desde);
  });

  it('la guía ya no manda abrir el GET de lectura con el código en la URL', () => {
    expect(guia).not.toContain('accion=leer&r=');
  });

  it('la prueba es un bloque PowerShell con POST, pide el código con Read-Host y no lo pone en una URL', () => {
    expect(bloque).toBeDefined();
    expect(bloque!.trimStart().startsWith('& {')).toBe(true);
    expect(bloque).toContain('-Method Post');
    expect(bloque).toContain("accion = 'leer'");
    expect(bloque).toContain('Read-Host');
    expect(bloque).not.toMatch(/[?&]r=/);
  });

  it('el paso conserva el código aleatorio, el generador, el veredicto negativo y la limpieza', () => {
    expect(paso).toMatch(/código\s+de\s+prueba\s+aleatorio/);
    expect(paso).toContain('`scripts/crear-revisores.ts`');
    expect(paso).toContain('codigo_no_activo');
    expect(paso).toMatch(/borra\s+las\s+filas\s+de\s+ese\s+código/);
  });
});

describe('la subsección de #162 (D10)', () => {
  const titulos = guia.split('\n').filter((l) => /^###\s.*#162/.test(l));
  const cuerpo = tramo(guia, /^###\s.*#162/);

  it('sigue habiendo un solo título con #162 y nombra #169 y #166', () => {
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toContain('#169');
    expect(titulos[0]).toContain('#166');
  });

  it('dice que el GET ya no lee y no habla de compatibilidad', () => {
    expect(cuerpo).toContain('#169');
    expect(cuerpo).toContain('#166');
    expect(cuerpo).not.toContain('por compatibilidad');
    expect(cuerpo).toMatch(/versión\s+vigente/);
  });

  it('comprueba el GET sin código y la autorización con versión vieja', () => {
    expect(cuerpo).toContain('`<URL>?accion=leer`');
    expect(cuerpo).toContain('"error":"formato"');
    expect(cuerpo).toContain("version = 'vieja'");
    expect(cuerpo).toMatch(/no\s+debe\s+ganar\s+ninguna\s+fila/);
  });

  it('pide --autorizaciones al importar y avisa del desfase de una pestaña abierta', () => {
    expect(cuerpo).toContain('--autorizaciones');
    expect(cuerpo).toMatch(/pestaña\s+abierta\s+con\s+la\s+app\s+anterior/);
  });

  it('el aviso de la subsección #157 dice lo que pasa hoy sin redesplegar y no promete un bucle', () => {
    const seccion = tramo(guia, /^###\s.*autorización/);
    expect(seccion).not.toContain('una y otra vez');
    expect(seccion).toMatch(/rechaza\s+la\s+aceptación\s+con\s+`formato`/);
    expect(seccion).toContain('Sin conexión: no se pudo registrar tu autorización');
  });

  it('la guía no escribe ninguna URL /exec', () => {
    expect(guia).not.toMatch(/\/macros\/s\//);
  });
});

describe('el diseño de la spec 03 y el ADR 0012 (D11, D12)', () => {
  it('la fila del importador dice que también lee el CSV de Autorizaciones con --autorizaciones', () => {
    const fila = diseno.split('\n').find((l) => l.startsWith('| Importador |'));
    expect(fila).toBeDefined();
    expect(fila).toContain('--autorizaciones');
    expect(fila).toContain('Autorizaciones');
  });

  it('ni el diseño ni el ADR describen un GET de compatibilidad', () => {
    expect(diseno).not.toMatch(/compatibilidad/);
    expect(adr).not.toContain('lectura de compatibilidad');
    expect(adr).toContain('#169');
  });

  it('el diseño dice que el GET ya no lee, que autorizar exige la versión y que guardar mira la casilla del vago', () => {
    expect(diseno).toContain('responde siempre `formato`, sin leer, #169');
    expect(diseno).toContain('también con una versión distinta de la vigente, #169');
    expect(diseno).toContain('esRespuestaDelVago');
  });

  it('el script y el cliente ya no dicen que el GET de lectura sigue por compatibilidad', () => {
    expect(leer('apps-script/Codigo.js')).not.toContain('por compatibilidad');
    expect(leer('src/lib/canal.ts')).not.toContain('por compatibilidad');
  });
});
