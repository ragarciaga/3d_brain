import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

describe('la guía de PanelRevision y el diálogo de envío', () => {
  const fuente = leer('src/components/PanelRevision.tsx');
  const inicio = fuente.indexOf('data-testid="como-revisar"');
  const fin = fuente.indexOf("vista === 'enviar'", inicio);
  const guia = fuente.slice(inicio, fin);
  const envio = fuente.slice(fin);

  it('la guía de PanelRevision no enlaza al registro y el diálogo de envío sí', () => {
    // Si los cortes no encuentran su marca, los demás expect pasarían sobre texto vacío o desordenado.
    expect(inicio).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(inicio);
    expect(guia).toContain("'intro'");
    expect(fuente).not.toContain('revision.guia.registrarme');
    expect(guia).not.toContain('urlRegistro');
    expect(guia).not.toContain('registrarme');
    expect(envio).toContain("t('revision.registrarme')");
    expect(envio).toContain('configRevision.urlRegistro');
  });
});

describe('docs/guia-docentes.md', () => {
  const texto = leer('docs/guia-docentes.md');

  it('no menciona registro, envío ni a tu nombre', () => {
    expect(texto).toContain('TU_CODIGO');
    expect(texto).not.toContain('Registrarme');
    expect(texto).not.toContain('docs.google.com/forms');
    expect(texto).not.toContain('a tu nombre');
    expect(texto).not.toContain('Enviar revisión');
    expect(texto).not.toContain('Enviar todo');
    expect(texto).not.toContain('Sí, lo envié');
    expect(texto).not.toMatch(/registr/i);
  });
});

describe('docs/revision-docente.md', () => {
  const texto = leer('docs/revision-docente.md');

  it('documenta pestañas, montaje PowerShell, alias y supresión', () => {
    for (const pestana of ['`Respuestas`', '`Autorizaciones`', '`Padrón`']) expect(texto, pestana).toContain(pestana);
    const bloques = [...texto.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques.some((b) => b.includes('apps-script\\Codigo.js'))).toBe(true);
    expect(texto.split('\n').some((l) => /^##\s/.test(l) && l.includes('supresión'))).toBe(true);
    expect(texto).toContain('Ley 1581');
    expect(texto).toContain('`revisado_por` es solo el alias del padrón');
    expect(texto).not.toContain('el nombre del registro');
  });

  it('el apartado de supresión borra de verdad: comodines reales, -WhatIf, historial de versiones e issues', () => {
    const inicio = texto.split('\n').findIndex((l) => /^##\s/.test(l) && l.includes('supresión'));
    expect(inicio).toBeGreaterThan(-1);
    const seccion = texto.split('\n').slice(inicio).join('\n');
    // Cada borrado se ensaya primero: toda línea Remove-Item de la sección (incluido el recursivo) termina en -WhatIf.
    const borrados = seccion.split('\n').filter((l) => /^\s*Remove-Item\b/.test(l));
    expect(borrados.length).toBeGreaterThanOrEqual(5);
    for (const linea of borrados) expect(linea, linea).toMatch(/-WhatIf\s*$/);
    for (const comodin of ['*Respuestas*.csv', '*Autorizaciones*.csv', '*Revisión del atlas*.csv*', '*Registro de revisores*.csv*']) {
      expect(seccion, comodin).toContain(comodin);
    }
    // El CSV de Autorizaciones también trae códigos de docentes (#166).
    expect(borrados.some((l) => l.includes('Downloads\\*Autorizaciones*.csv'))).toBe(true);
    expect(seccion).not.toContain('Downloads\\Respuestas*.csv');
    expect(seccion).toContain('historial de versiones');
    expect(seccion).toContain('Hacer una copia');
    expect(seccion).toContain('issues de importación');
    expect(seccion).toContain('Edit history');
    expect(seccion).toContain('pipeline\\salida\\revisiones');
    expect(seccion).toMatch(/todos\s+los\s+docentes/);
    expect(texto).not.toMatch(/ya\s+no\s+se\s+puede\s+ligar/i);
    // El paso 4 dice lo que de verdad queda, sin prometer anonimato.
    const paso4 = seccion.match(/^4\.\s+Explícale[\s\S]*?(?=^5\.\s)/m)?.[0] ?? '';
    expect(paso4).toMatch(/alias/);
    expect(paso4).toMatch(/historial\s+de\s+Git/i);
    expect(paso4).toMatch(/copias\s+que\s+no\s+controlas/);
  });

  it('la sección 4 pide los dos CSV, pasa --autorizaciones y explica las descartadas del vago (#163)', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^##\s+4\.\s+Procesar las revisiones/.test(l));
    expect(inicio).toBeGreaterThan(-1);
    const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
    expect(fin).toBeGreaterThan(inicio);
    const seccion = lineas.slice(inicio, fin).join('\n');
    expect(seccion).toContain('`Autorizaciones`');
    // El comando de la importación pasa las dos descargas y la bandera, en el mismo bloque.
    const bloques = [...seccion.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques.some((b) => b.includes('--autorizaciones') && b.includes('- Respuestas.csv') && b.includes('- Autorizaciones.csv'))).toBe(true);
    expect(seccion).toContain('Descartadas: sin la casilla del vago');
    expect(seccion).toMatch(/solo\s+del\s+archivo\s+de\s+`--autorizaciones`/);
    // Los CSV traen códigos: cada borrado se ensaya primero.
    const borrados = seccion.split('\n').filter((l) => /^\s*Remove-Item\b/.test(l));
    expect(borrados.length).toBeGreaterThanOrEqual(2);
    for (const linea of borrados) expect(linea, linea).toMatch(/-WhatIf\s*$/);
    // Un encabezado nuevo con "autorización" confundiría el caso del redespliegue (#157).
    expect(seccion.split('\n').filter((l) => /^###\s.*autorización/.test(l))).toEqual([]);
  });

  it('la sección 4 explica el borrado previo de los .md, que no sigue enlaces y el conteo sin autorización (#166)', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^##\s+4\.\s+Procesar las revisiones/.test(l));
    const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
    const seccion = lineas.slice(inicio, fin).join('\n');
    expect(seccion).toMatch(/borra\s+los\s+`\.md`/);
    expect(seccion).toMatch(/sin\s+pasar\s+por\s+la\s+papelera/);
    expect(seccion).toMatch(/no\s+sigue\s+enlaces/);
    expect(seccion).toMatch(/no\s+toca\s+el\s+resto\s+de\s+`pipeline\/salida\/`/);
    expect(seccion).toMatch(/se\s+detiene\s+sin\s+borrar\s+nada/);
    expect(seccion).toMatch(/sin\s+ninguna\s+autorización/);
    expect(seccion).toMatch(/borra\s+sus\s+filas/);
    expect(seccion).not.toMatch(/segunda\s+corrida\s+reescribe/);
  });

  it('trata el código como contraseña, no llama privada a la pestaña Padrón y no presenta el chat como protección', () => {
    expect(texto).toMatch(/trátalo\s+como\s+una\s+contraseña/);
    expect(texto).not.toContain('no es una contraseña');
    expect(texto).not.toContain('Es una pestaña privada');
    expect(texto).toContain('no se comparte con nadie');
    expect(texto).toContain('Regla del editor, no una protección');
    expect(texto).not.toContain('pero el editor la pasa solo por chat');
    // La prueba rápida usa un código aleatorio propio: uno fijo y publicado dejaría escribir en la hoja a cualquiera.
    expect(texto).not.toContain('PRUEBA99');
    expect(texto).toContain('`scripts/crear-revisores.ts`');
    expect(texto).toMatch(/código\s+de\s+prueba\s+aleatorio/);
    expect(texto).toContain('Win+V');
    expect(texto).toContain('Set-Clipboard -Value $null');
  });

  it('explica cómo volver a desplegar el script como Nueva versión para que guardar exija la autorización (#157)', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^###\s.*autorización/.test(l));
    expect(inicio).toBeGreaterThan(-1);
    const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
    const seccion = lineas.slice(inicio, fin === -1 ? undefined : fin).join('\n');
    expect(seccion).toMatch(/Nueva\s+versión/);
    expect(seccion).toMatch(/Nunca\s+"Nueva\s+implementación"/);
    expect(seccion).toMatch(/URL\s+`\/exec`\s+no\s+cambia/);
    expect(seccion).toContain('sin_autorizacion');
    expect(seccion).toContain('VERSION_AUTORIZACION');
    // El orden: primero la app publicada, después el script, y al final la comprobación.
    expect(seccion).toMatch(/workflow\s+`pages`/);
    expect(seccion).toMatch(/antes\s+de\s+mandar\s+los\s+enlaces/);
    expect(seccion).toMatch(/borra\s+todas\s+sus\s+filas\s+en\s+`Autorizaciones`/i);
    expect(texto).toMatch(/Borrar\s+solo\s+la\s+última\s+fila\s+no\s+basta/);
  });

  it('explica cómo volver a desplegar el script de #162: primero el sitio, luego Nueva versión, y la caché de un minuto', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^###\s.*#162/.test(l));
    expect(inicio).toBeGreaterThan(-1);
    const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
    const seccion = lineas.slice(inicio, fin === -1 ? undefined : fin);
    const cuerpo = seccion.join('\n');
    expect(cuerpo).toMatch(/Nueva\s+versión/);
    expect(cuerpo).toMatch(/Nunca\s+"Nueva\s+implementación"/);
    expect(cuerpo).toContain('VERSION_AUTORIZACION');
    expect(cuerpo).toMatch(/un\s+minuto/);
    expect(cuerpo).toMatch(/antes\s+de\s+mandar\s+los\s+enlaces/);
    expect(cuerpo).toMatch(/alias/);
    expect(cuerpo).toMatch(/issues\s+públicos/);
    // El orden de los pasos numerados: el workflow `pages` (el sitio) antes que el paso de Nueva versión (el script).
    const paso = (re: RegExp) => seccion.findIndex((l) => /^\d+\.\s/.test(l) && re.test(l));
    const sitio = paso(/workflow\s+`pages`/);
    const pegar = paso(/copia\s+el\s+script/);
    const nueva = paso(/Nueva\s+versión/);
    expect(sitio).toBeGreaterThan(-1);
    expect(pegar).toBeGreaterThan(sitio);
    expect(nueva).toBeGreaterThan(pegar);
    const bloques = [...cuerpo.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques.some((b) => b.includes('apps-script\\Codigo.js'))).toBe(true);
  });

  it('la subsección de #162 dice que un solo despliegue cubre las versiones 2 y 3 (#168)', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^###\s.*#162/.test(l));
    expect(inicio).toBeGreaterThan(-1);
    const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
    const cuerpo = lineas.slice(inicio, fin === -1 ? undefined : fin).join('\n');
    expect(cuerpo).toMatch(/versiones\s+2\s+y\s+3/);
    expect(cuerpo).toContain('#168');
    expect(cuerpo).toContain('Versión `3`');
    expect(cuerpo).not.toContain('Versión `2`');
    expect(cuerpo).not.toContain('sigue leyendo por GET');
  });

  it('la sección de supresión publica el contacto de las solicitudes (#168)', () => {
    const lineas = texto.split('\n');
    const inicio = lineas.findIndex((l) => /^##\s/.test(l) && l.includes('supresión'));
    expect(inicio).toBeGreaterThan(-1);
    expect(lineas.slice(inicio).join('\n')).toContain('info@maysasp.com');
  });

  it.each(['docs/adr/0012-apps-script-canal-revision.md', 'docs/adr/0015-analitica-sin-cookies.md'])('%s enlaza la página Privacidad en los dos idiomas (#168)', (ruta) => {
    const adr = leer(ruta);
    expect(adr).toContain('/es/privacidad');
    expect(adr).toContain('/en/privacy');
    expect(adr).toMatch(/Amended:.*#168/);
  });

  it('la guía del editor no lleva ninguna URL /exec del script', () => {
    expect(texto).not.toMatch(/script\.google\.com\/macros\/s\/[\w-]+/);
    expect(texto).not.toMatch(/\/macros\/s\//);
  });
});
