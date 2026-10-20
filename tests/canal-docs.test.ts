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
    expect(paso).toContain('Crear revisor');
    expect(paso).toContain('codigo_no_activo');
    expect(paso).toMatch(/borra\s+las\s+filas\s+de\s+ese\s+código/);
  });

  it('pide esperar un minuto después de marcar la fila de prueba con Activo `sí` y antes del primer bloque (#185)', () => {
    // Con la caché del Padrón caliente, la primera prueba podría responder codigo_no_activo aunque la fila diga sí.
    const espera = paso.search(/Activo\s+`sí`\.\s+Después\s+de\s+agregar\s+la\s+fila,\s+espera\s+un\s+minuto[^.]*antes\s+de\s+pegar\s+el\s+bloque/);
    expect(espera).toBeGreaterThan(-1);
    expect(espera).toBeLessThan(paso.indexOf('```powershell'));
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

  it('la prueba con versión vieja va antes de pasar el código de prueba a no, y la limpieza al final', () => {
    // doPost revisa el Padrón antes que accionAutorizar: con Activo en no respondería codigo_no_activo.
    const vieja = cuerpo.indexOf("version = 'vieja'");
    const inactivo = cuerpo.search(/Cambia\s+Activo\s+a\s+`no`/);
    const limpieza = cuerpo.search(/Limpia\s+como\s+dice\s+el\s+paso\s+7/);
    expect(vieja).toBeGreaterThan(-1);
    expect(inactivo).toBeGreaterThan(-1);
    expect(limpieza).toBeGreaterThan(-1);
    expect(vieja).toBeLessThan(inactivo);
    expect(inactivo).toBeLessThan(limpieza);
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

describe('quitar una marca se guarda (#217)', () => {
  const titulos = guia.split('\n').filter((l) => /^###\s.*#217/.test(l));
  const cuerpo = tramo(guia, /^###\s.*#217/);
  const requisitos = leer('docs/specs/03-review-return-channel/requirements.md');
  const spec = leer('SPEC.md');

  it('la guía tiene una sola subsección con #217, con el bloque PowerShell que primero deja main al día', () => {
    expect(titulos).toHaveLength(1);
    const bloques = [...cuerpo.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques).toHaveLength(1);
    const lineas = bloques[0]!.split('\n').map((l) => l.trim());
    const idx = (inicio: string) => lineas.findIndex((l) => l.startsWith(inicio));
    expect(idx('cd C:\\Users\\')).toBe(0);
    expect(idx('git switch main')).toBeGreaterThan(0);
    expect(idx('git pull --ff-only')).toBeGreaterThan(idx('git switch main'));
    expect(idx('git status')).toBeGreaterThan(idx('git pull --ff-only'));
    expect(idx('Get-Content -Raw -Encoding UTF8 apps-script\\Codigo.js | Set-Clipboard')).toBeGreaterThan(idx('git status'));
  });

  it('la subsección pide detenerse y avisar por chat si Google pide permisos nuevos o si la URL cambió, y no escribe la URL', () => {
    expect(cuerpo).toMatch(/Si\s+Google\s+pide\s+permisos\s+nuevos\s+al\s+implementar,\s+detente\s+y\s+avisa\s+por\s+chat/);
    expect(cuerpo).toMatch(/Si\s+cambió,\s+avísalo\s+por\s+chat\s+y\s+no\s+la\s+pegues/);
    expect(cuerpo).not.toMatch(/\/macros\/s\//);
    expect(cuerpo).not.toContain('script.google.com');
  });

  it('el orden es el sitio primero y el script después, y la prueba revisa la frase, la fila con "d":"" y que la marca no vuelva', () => {
    expect(cuerpo.indexOf('workflow `pages`')).toBeLessThan(cuerpo.indexOf('Get-Content'));
    expect(cuerpo.replace(/\s+/g, ' ')).toContain('Si te equivocas, elige el veredicto correcto; quitar la marca no se guarda.');
    expect(cuerpo).toContain('"d":""');
    expect(cuerpo).toMatch(/la marca no vuelve/);
    expect(cuerpo).toMatch(/Limpia\s+como\s+dice\s+el\s+paso\s+7/);
  });

  it('la guía aclara que un retiro no suprime datos personales y que la supresión sigue en la sección 7', () => {
    expect(cuerpo).toMatch(/no\s+borra\s+nada\s+de\s+la\s+hoja\s+ni\s+suprime\s+datos\s+personales/);
    expect(cuerpo).toContain('sección 7');
    expect(tramo(guia, /^## 7\./).replace(/\s+/g, ' ')).toContain('filas de retiro (#217)');
  });

  it('la sección 5 dice que el formulario de respaldo no lleva retiros', () => {
    const seccion5 = tramo(guia, /^## 5\./);
    expect(seccion5).toMatch(/formulario\s+no\s+lleva\s+retiros/);
    expect(seccion5).toContain('"d":""');
  });

  it('el ADR 0012 lo registra en Amended y dice que el retiro no lleva texto de propuesta ni de comentario', () => {
    expect(adr).toMatch(/Amended:[^\n]*#217/);
    expect(adr).toContain('no lleva texto de propuesta ni de comentario');
    expect(adr).not.toContain('no lleva texto libre');
  });

  it('la spec 03 y SPEC.md F24 lo dicen, sin afirmar que el retiro no lleva texto libre', () => {
    for (const r of ['R3.8', 'R3.9', 'R4.5', 'R7.3', 'R8.3']) expect(requisitos, r).toMatch(new RegExp(`^- ${r.replace('.', '\\.')} `, 'm'));
    expect(spec).toContain('también se guarda, como un retiro');
    for (const texto of [requisitos, diseno, spec, adr, guia]) expect(texto).not.toMatch(/retiro[^.\n]*no lleva texto libre|sin texto libre[^.\n]*retiro/i);
  });

  it('nada de lo que habla del retiro o de las marcas retiradas dice "sin texto libre": el campo de un trazo admite 120 caracteres', () => {
    // R8.3 va a un issue público con el campo de la marca; el comentario de `MarcaRetirada` y los de `Retiro` lo describen.
    expect(requisitos).not.toMatch(/sin texto libre/i);
    const comentarioDe = (ruta: string, simbolo: string) => {
      const texto = leer(ruta);
      const fin = texto.indexOf(simbolo);
      expect(fin, `${simbolo} en ${ruta}`).toBeGreaterThan(-1);
      return texto.slice(Math.max(0, fin - 700), fin);
    };
    for (const [ruta, simbolo] of [
      ['scripts/lib/revisiones.ts', 'export interface MarcaRetirada'],
      ['src/lib/revision.ts', 'export interface Retiro '],
      ['src/lib/revision.ts', 'const CAMPOS_PROHIBIDOS_EN_RETIRO'],
      ['apps-script/Codigo.js', 'const CAMPOS_PROHIBIDOS_EN_RETIRO'],
    ] as const) {
      expect(comentarioDe(ruta, simbolo), `${simbolo} en ${ruta}`).not.toMatch(/sin texto libre|ni texto libre|no lleva texto libre/i);
    }
    expect(comentarioDe('scripts/lib/revisiones.ts', 'export interface MarcaRetirada')).toContain('el campo de un trazo admite hasta 120 caracteres');
    expect(requisitos).toContain('el campo de un trazo admite hasta 120 caracteres');
  });

  it('el docstring de importar, el encabezado del script y el comentario de Envio.retiros dicen que solo se quita lo de la hoja y que se cuentan las claves sin respuesta', () => {
    const normal = (t: string) => t.replace(/^\s*(\/\/|\*|\/\*\*)\s?/gm, '').replace(/\s+/g, ' ');
    const lib = leer('scripts/lib/revisiones.ts');
    const docstringImportar = normal(lib.slice(lib.lastIndexOf('/**', lib.indexOf('export function importar(')), lib.indexOf('export function importar(')));
    const comentarioRetiros = normal(lib.slice(lib.lastIndexOf('/**', lib.indexOf('  retiros?: Retiro[]')), lib.indexOf('  retiros?: Retiro[]')));
    const encabezado = normal(leer('scripts/importar-revisiones.ts').split('\n').slice(0, 25).join('\n'));
    for (const [nombre, texto] of [['docstring de importar', docstringImportar], ['comentario de Envio.retiros', comentarioRetiros], ['encabezado del script', encabezado]] as const) {
      expect(texto, nombre).toMatch(/formulario/);
      expect(texto, nombre).toMatch(/v:1/);
      expect(texto, nombre).toMatch(/Respuestas/);
    }
    expect(docstringImportar).toMatch(/solo las claves que quedaron sin ninguna respuesta/);
    expect(encabezado).toMatch(/solo las claves que quedan sin ninguna respuesta/);
    expect(comentarioRetiros).toMatch(/nunca a las del formulario ni a las `v:1`/);
    // Lo viejo: "cuenta las marcas quitadas" sin condición, y "las aplica a las respuestas de envíos anteriores del mismo revisor".
    expect(docstringImportar).not.toMatch(/cuenta las marcas quitadas/);
    expect(comentarioRetiros).not.toMatch(/a las respuestas de envíos anteriores del mismo revisor\./);
  });

  it('la guía dice que el conteo de marcas retiradas puede ser 0 y que el formulario vuelve a verse', () => {
    const bullet = guia.replace(/\s+/g, ' ');
    expect(bullet).toContain('solo las claves que quedaron sin ninguna respuesta');
    expect(bullet).toContain('el conteo puede ser 0');
    expect(bullet).toContain('el visible vuelve a ser el del formulario');
  });

  it('la tabla "Verification summary" de la spec 03 coincide con las etiquetas de los requisitos', () => {
    const lineas = requisitos.split('\n').filter((l) => /^- R\d+\.\d+ /.test(l));
    for (const etiqueta of ['unit', 'integration', 'e2e', 'eval', 'manual']) {
      const n = lineas.filter((l) => l.includes(`\`[${etiqueta}]\``)).length;
      expect(requisitos, etiqueta).toMatch(new RegExp(`^\\| ${etiqueta} \\| ${n} \\|$`, 'm'));
    }
  });

  it('el diseño de la spec 03 menciona los retiros en la interfaz de leer y en la idempotencia', () => {
    const fila = diseno.split('\n').find((l) => l.includes("`POST <urlCanal>` `{accion:'leer', r}`"));
    expect(fila).toContain('retiradas (v:2 con esos retiros)');
    expect(fila).toContain('`{ok, canal, respuestas');
    const viñeta = diseno.split('\n').find((l) => l.startsWith('- **Idempotencia:**'));
    expect(viñeta).toContain('la clave sale de `respuestas` y queda en `retiradas`');
    expect(viñeta).toContain('se rechaza con `formato`');
  });

  it('la cabecera del script y la del cliente describen la forma nueva de leer, sin la vieja', () => {
    const cabecera = (ruta: string) =>
      leer(ruta)
        .split('\n')
        .slice(0, 30)
        .map((l) => l.replace(/^\/\/\s?/, ''))
        .join(' ')
        .replace(/\s+/g, ' ');
    expect(cabecera('apps-script/Codigo.js')).toContain("{accion: 'leer', r}: {ok, canal, respuestas: {v: 2, r, e}, retiradas: {v: 2, r, e}, autorizacion: {version, vago} | null}");
    expect(cabecera('src/lib/canal.ts')).toContain(
      '`{ok:true, canal:<número>, respuestas:{v:2, r:<código>, e:{<id>:[{<claves cortas, con f>}]}}, retiradas:{v:2, r:<código>, e:{<id>:[{c, i?, d:"", f}]}}, autorizacion:{version, vago} | null}`',
    );
    for (const ruta of ['apps-script/Codigo.js', 'src/lib/canal.ts']) expect(cabecera(ruta), ruta).not.toMatch(/\{ok, respuestas|\{ok:true, respuestas/);
  });
});

describe('la pestaña Padrón es la única fuente (#257)', () => {
  const titulos = guia.split('\n').filter((l) => /^###\s.*#257/.test(l));
  const lineas = guia.split('\n');
  const inicio = lineas.findIndex((l) => /^###\s.*#257/.test(l));
  const fin = lineas.findIndex((l, i) => i > inicio && /^##+\s/.test(l));
  const cuerpo = lineas.slice(inicio, fin).join('\n');

  it('la guía tiene una sola subsección con #257, sin "autorización" en el título (otra prueba busca ese título para #157)', () => {
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).not.toMatch(/autorización/);
  });

  it('el bloque PowerShell deja main al día antes de copiar el script, y la subsección no escribe la URL del script', () => {
    const bloques = [...cuerpo.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const bloque = bloques.find((b) => b.includes('Set-Clipboard'));
    expect(bloque).toBeDefined();
    const idx = (inicio: string) => bloque!.split('\n').findIndex((l) => l.trim().startsWith(inicio));
    expect(idx('git switch main')).toBeGreaterThan(-1);
    expect(idx('git pull --ff-only')).toBeGreaterThan(idx('git switch main'));
    expect(idx('git status')).toBeGreaterThan(idx('git pull --ff-only'));
    expect(idx('Get-Content -Raw -Encoding UTF8 apps-script\\Codigo.js | Set-Clipboard')).toBeGreaterThan(idx('git status'));
    expect(cuerpo).not.toMatch(/\/macros\/s\//);
    expect(cuerpo).not.toContain('script.google.com');
  });

  it('pide Nueva versión (nunca Nueva implementación), nombra los permisos esperados y manda detenerse ante cualquier otro', () => {
    expect(cuerpo).toMatch(/Nueva\s+versión/);
    expect(cuerpo).toMatch(/Nunca\s+"Nueva\s+implementación"/);
    const plano = cuerpo.replace(/\s+/g, ' ');
    expect(plano).toContain('ver, editar, crear y borrar solo esta hoja de cálculo');
    expect(plano).toContain('"Mostrar y ejecutar contenido web de terceros en mensajes y barras laterales"');
    expect(plano).toContain('"Display and run third-party web content in prompts and sidebars inside Google applications"');
    expect(plano).toMatch(/texto exacto de estos permisos se confirma en la prueba manual D10/);
    expect(cuerpo.replace(/\s+/g, ' ')).toMatch(/Drive, todas tus hojas de cálculo, servicios externos, correo\), detente, no aceptes y avísalo por chat/);
  });

  it('la migración se detiene si ya repartiste un código, no nombra D01 a D10 y manda repetir sin -WhatIf', () => {
    const plano = cuerpo.replace(/\s+/g, ' ');
    expect(plano).not.toMatch(/D01 a D10/);
    expect(plano).toMatch(/Si ya repartiste algún código a un docente, detente y avísalo por chat antes de borrar nada/);
    expect(plano).toMatch(/ejecuta los mismos comandos otra vez sin `-WhatIf`/);
  });

  it('un código creado con el menú normalmente sirve enseguida, y si responde codigo_no_activo se espera un minuto y se repite, en el paso 7 y en la migración', () => {
    const paso7 = guia.slice(guia.indexOf('7. Prueba rápida'), guia.indexOf('Para actualizar el script'));
    const plano7 = paso7.replace(/\s+/g, ' ');
    const plano = cuerpo.replace(/\s+/g, ' ');
    for (const [nombre, texto] of [['paso 7', plano7], ['migración', plano]] as const) {
      expect(texto, nombre).toMatch(/normalmente sirve enseguida, porque el menú vacía la caché/i);
      expect(texto, nombre).toMatch(/`codigo_no_activo`[^.]*espera un minuto y repítela/);
      expect(texto, nombre).not.toMatch(/no hace falta esperar|a menos de un minuto de crearlo|sirve enseguida\./);
    }
    expect(plano7).toMatch(/una petición que ya estaba en curso pudo volver a guardar la lista vieja/);
    expect(plano7).toMatch(/Una fila escrita a mano puede tardar hasta un minuto/);
  });

  it('la migración solo sigue si no repartiste códigos, igual que su punto 2', () => {
    const plano = cuerpo.replace(/\s+/g, ' ');
    expect(plano).toContain('sigue solo si no has repartido ninguno (el punto 2 te manda detenerte si ya repartiste alguno)');
    expect(plano).not.toMatch(/Como todavía no has repartido ningún código/);
  });

  it('la sección 2 pide limpiar el portapapeles, no "límpiate"', () => {
    const seccion = tramo(guia, /^## 2\./);
    expect(seccion).toContain('limpia el portapapeles después');
    expect(seccion).not.toMatch(/límpiate/);
  });

  it('la migración borra el padrón viejo del Drive y de los equipos, y vacía la papelera', () => {
    expect(cuerpo).toContain('revisores.local.json');
    expect(cuerpo).toContain('Eliminar definitivamente');
    expect(cuerpo).toContain('enlaces-docentes.md');
    for (const l of cuerpo.split('\n').filter((l) => /^\s*Remove-Item\b/.test(l))) expect(l).toMatch(/-WhatIf\s*$/);
  });

  it('el ADR 0012, el ADR 0008, el diseño y SPEC.md lo registran', () => {
    expect(adr).toMatch(/Amended:[^\n]*#257/);
    expect(adr).toContain('La pestaña `Padrón` es la única fuente del padrón (#257)');
    expect(leer('docs/adr/0008-revision-docente.md')).toMatch(/Actualización 2026-10-19 \(#257\)/);
    expect(diseno).toContain('Maysa Brain');
    expect(diseno).not.toContain('y en `pipeline/revisores.local.json`');
    const spec = leer('SPEC.md');
    expect(spec).toContain('`--padron`');
    expect(spec).not.toContain('(`pipeline/revisores.local.json`, fuera de git)');
  });

  it('la sección 4 pasa --padron en el comando de la importación y pide borrar el CSV del Padrón', () => {
    const seccion = tramo(guia, /^## 4\./);
    const bloques = [...seccion.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques.some((b) => b.includes('--padron') && b.includes('- Padrón.csv'))).toBe(true);
    expect(bloques.some((b) => /Remove-Item .*- Padrón\.csv" -WhatIf/.test(b))).toBe(true);
    expect(seccion.replace(/\s+/g, ' ')).toContain('Activo no filtra lo que viene de la pestaña `Respuestas`');
  });
});
