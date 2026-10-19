// Menú "Maysa Brain" del Apps Script (#257): crear revisores desde la hoja. apps-script/Codigo.js se carga en
// Node con `node:vm` y los dobles de tests/fixtures/apps-script/dobles.ts. Los códigos de estas pruebas son
// inventados. Lo que Google hace de verdad (getUuid aleatorio, el permiso de la interfaz, que el menú corra con
// el código guardado) no se puede comprobar aquí: lo cubre la comprobación manual de la subsección #257 de docs/revision-docente.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conteoFilas, crearEntorno, CODIGO_ACTIVO, CODIGO_AUSENTE, PADRON_PRUEBA, RUTA_SCRIPT, type Entorno } from './fixtures/apps-script/dobles';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORMATO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;
const SITIO = 'https://brain.maysasp.com';
/** Un código de 10 símbolos del alfabeto que no es un tramo del alfabeto (el script no puede llevarlo). */
const REPETIDO = 'KQ7M2XTBH4';

const crearCodigo = (env: Entorno) => env.fn<(azar: (max: number) => number, existentes: string[]) => string>('crearCodigo');
const azarSeguro = (env: Entorno) => env.fn<(max: number) => number>('azarSeguro');
const aliasSiguiente = (env: Entorno) => env.fn<(aliases: unknown[]) => string>('aliasSiguiente');
/** Un `azar` que devuelve los índices de `texto` en el alfabeto, uno por llamada, y después ceros. */
const azarDeTexto = (texto: string) => {
  const cola = [...texto].map((c) => ALFABETO.indexOf(c));
  return () => cola.shift() ?? 0;
};
/** Los bytes que hacen que `azarSeguro(31)` devuelva, uno por resumen, los símbolos de `texto`. */
const bytesDe = (texto: string): number[][] => [...texto].map((c) => [ALFABETO.indexOf(c)]);
/** Las filas que el menú agregó al Padrón, sin las del padrón de prueba. */
const nuevas = (env: Entorno, antes = PADRON_PRUEBA.length) => env.escritas('Padrón').slice(antes);

describe('crearCodigo (D1)', () => {
  it('da 10 símbolos del alfabeto sin I, L, O, 0 ni 1, en 50 llamadas con el azar real', () => {
    const env = crearEntorno();
    const azar = azarSeguro(env);
    const vistos = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = crearCodigo(env)(azar, []);
      expect(c).toMatch(FORMATO);
      vistos.add(c);
    }
    expect(vistos.size).toBe(50);
  });

  it('nunca devuelve uno de los existentes: con una colisión forzada da el siguiente', () => {
    const env = crearEntorno();
    const azar = azarDeTexto('AAAAAAAAAA' + 'BBBBBBBBBB');
    expect(crearCodigo(env)(azar, ['AAAAAAAAAA'])).toBe('BBBBBBBBBB');
  });

  it('si el azar se atasca, lanza tras 100 intentos', () => {
    const env = crearEntorno();
    let llamadas = 0;
    const atascado = () => {
      llamadas++;
      return 0;
    };
    expect(() => crearCodigo(env)(atascado, ['AAAAAAAAAA'])).toThrow(/sin_codigo/);
    expect(llamadas).toBe(100 * 10);
  });

  it.each([
    ['negativo', -1],
    ['igual al largo del alfabeto', 31],
    ['no entero', 1.5],
    ['no numérico', NaN],
  ])('un azar fuera de rango (%s) lanza en vez de acortar el código', (_n, valor) => {
    const env = crearEntorno();
    expect(() => crearCodigo(env)(() => valor, [])).toThrow(/azar_invalido/);
  });
});

describe('azarSeguro (D1)', () => {
  it.each([1, 2, 7, 31, 100, 255, 256])('con max %i da enteros en [0, max) y usa Utilities.computeDigest', (max) => {
    const env = crearEntorno();
    const vistos = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const n = azarSeguro(env)(max);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(max);
      vistos.add(n);
    }
    expect(env.resumenes.length).toBeGreaterThanOrEqual(300);
    if (max <= 31) expect(vistos.size).toBe(max);
  });

  it('el resumen sale de dos UUID juntos', () => {
    const env = crearEntorno();
    azarSeguro(env)(31);
    expect(env.resumenes[0]).toMatch(/^[0-9a-f-]{36}[0-9a-f-]{36}$/);
    expect(env.resumenes[0]!.slice(0, 36)).not.toBe(env.resumenes[0]!.slice(36));
  });

  it('descarta los bytes sesgados: con max 31 el corte es 248 y los bytes con signo se pasan a sin signo', () => {
    const env = crearEntorno();
    // 255, 250 y 248 se rechazan (el doble los entrega con signo: -1, -6, -8); el primer byte bueno es 5.
    env.sembrarBytes([255, 250, 248, 5]);
    expect(azarSeguro(env)(31)).toBe(5);
    // 247 es el último byte que vale: 247 % 31 = 30.
    env.sembrarBytes([247]);
    expect(azarSeguro(env)(31)).toBe(30);
  });

  it('dos llamadas seguidas no reutilizan bytes: cada una pide su propio resumen', () => {
    const env = crearEntorno();
    env.sembrarBytes([3, 4, 5], [9, 8]);
    expect(azarSeguro(env)(100)).toBe(3);
    expect(azarSeguro(env)(100)).toBe(9);
    expect(env.resumenes).toHaveLength(2);
  });

  it.each([0, 257, 1.5, -3, NaN, Infinity, '31', null, undefined])('lanza con max %s', (max) => {
    const env = crearEntorno();
    expect(() => (azarSeguro(env) as (m: unknown) => number)(max)).toThrow(/azar_invalido/);
  });

  it('lanza si el resumen nunca trae un byte que sirva, en vez de quedarse en un bucle', () => {
    const env = crearEntorno();
    env.sembrarBytes(...Array.from({ length: 200 }, () => [255]));
    expect(() => azarSeguro(env)(31)).toThrow(/azar_agotado/);
  });
});

describe('aliasSiguiente (D2)', () => {
  it.each<[string, unknown[], string]>([
    ['sin alias', [], 'D01'],
    ['tras D01 a D12', Array.from({ length: 12 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`), 'D13'],
    ['tras D09', ['D09'], 'D10'],
    ['tras D99', ['D99'], 'D100'],
    ['tras D100', ['D100'], 'D101'],
    ['tras D998', ['D998'], 'D999'],
    ['con huecos: manda el mayor, no la cuenta', ['D02', 'D07'], 'D08'],
    ['con espacios alrededor', [' D05 '], 'D06'],
    ['ignora vacíos, inválidos y números', ['', 'x', 'D1', 'D1000', 'D01x', 'd05', 'D0001', 5, null, undefined, 'D-3'], 'D01'],
  ])('%s', (_nombre, aliases, esperado) => {
    expect(aliasSiguiente(crearEntorno())(aliases)).toBe(esperado);
  });

  it('lanza si pasaría de D999', () => {
    expect(() => aliasSiguiente(crearEntorno())(['D999'])).toThrow(/sin_alias/);
  });
});

describe('onOpen y el menú (D3)', () => {
  it('crea el menú "Maysa Brain" con "Crear revisor" y "Crear revisores…" y lo agrega a la interfaz', () => {
    const env = crearEntorno();
    env.fn<() => void>('onOpen')();
    expect(env.menus).toEqual([
      { nombre: 'Maysa Brain', items: [['Crear revisor', 'crearRevisor'], ['Crear revisores…', 'crearRevisores']], agregado: true },
    ]);
    // Cada manejador del menú existe como función de nivel superior: el menú lo llama por su nombre.
    for (const [, funcion] of env.menus[0]!.items) expect(typeof env.fn(funcion)).toBe('function');
  });
});

describe('crearRevisor (D3)', () => {
  it('agrega [código, alias, sí] con formato de texto, con el bloqueo tomado, y borra la caché del padrón', () => {
    const env = crearEntorno();
    env.fn<() => void>('crearRevisor')();
    const [fila, ...otras] = nuevas(env);
    expect(otras).toHaveLength(0);
    expect(fila).toEqual([expect.stringMatching(FORMATO), 'D05', 'sí']);
    const fila5 = PADRON_PRUEBA.length + 2; // la cabecera es la fila 1
    for (const columna of [1, 2, 3]) expect(env.hojas.Padrón.formatos.get(`${fila5},${columna}`)).toBe('@');
    expect(env.hojas.Padrón.formulas.size).toBe(0);
    expect(env.candado.escriturasSinCandado).toBe(0);
    expect(env.candado.esperas).toEqual([10000]);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.removidos).toEqual(['padron']);
    expect(env.flushes()).toBe(1);
    // No toca las otras pestañas.
    expect(env.escritas('Respuestas')).toHaveLength(0);
    expect(env.escritas('Autorizaciones')).toHaveLength(0);
  });

  it('el aviso trae el alias y el enlace personal, y sale con el bloqueo ya liberado', () => {
    const env = crearEntorno();
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env)[0]![0]);
    expect(env.alertas).toHaveLength(1);
    const a = env.alertas[0]!;
    expect(a.titulo).toBe('Revisor D05');
    expect(a.texto).toContain(`${SITIO}/es/revision?r=${codigo}`);
    expect(a.texto).toMatch(/canal privado/);
    expect(a.botones).toBe('BOTONES_OK');
    expect(a.bloqueoTomado).toBe(false);
  });

  it('con la caché del padrón caliente, el código nuevo sirve de inmediato en leer', () => {
    const env = crearEntorno();
    expect(env.postLeer(CODIGO_ACTIVO)['ok']).toBe(true); // calienta la caché con el padrón viejo
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env)[0]![0]);
    const respuesta = env.postLeer(codigo);
    expect(respuesta['ok']).toBe(true);
    expect(respuesta['error']).toBeUndefined();
  });

  it('el alias que sigue es el mayor del Padrón más uno, aunque falten números', () => {
    const env = crearEntorno({ padron: [['AAAAAAAAAA', 'D02', 'sí'], ['BBBBBBBBBB', 'D12', 'no']] });
    env.fn<() => void>('crearRevisor')();
    expect(nuevas(env, 2)[0]![1]).toBe('D13');
  });

  it('un código que ya está en el Padrón, también uno inactivo y con espacios alrededor, no se vuelve a dar', () => {
    const repetido = REPETIDO;
    const env = crearEntorno({ padron: [[` ${repetido} `, 'D01', 'no']] });
    env.sembrarBytes(...bytesDe(repetido));
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env, 1)[0]![0]);
    expect(codigo).toMatch(FORMATO);
    expect(codigo).not.toBe(repetido);
    expect(env.resumenes.length).toBeGreaterThan(10); // el primer intento se descartó y se pidió otro
  });

  it('sin pestaña Padrón: no escribe, libera el bloqueo y avisa con un texto fijo sin el mensaje de la excepción', () => {
    const env = crearEntorno({ sinPestana: 'Padrón' });
    const antes = conteoFilas(env);
    env.fn<() => void>('crearRevisor')();
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.removidos).toEqual([]);
    expect(env.alertas).toHaveLength(1);
    const texto = env.alertas[0]!.titulo + env.alertas[0]!.texto;
    expect(texto).toContain('No se creó ningún revisor');
    expect(texto).not.toContain('sin_pestana');
    expect(texto).not.toContain(SITIO);
    expect(env.alertas[0]!.bloqueoTomado).toBe(false);
  });

  it('con los alias agotados: no escribe y el aviso dice que no quedan alias, no que falte la pestaña', () => {
    const env = crearEntorno({ padron: [['AAAAAAAAAA', 'D999', 'sí']] });
    env.fn<() => void>('crearRevisor')();
    expect(nuevas(env, 1)).toHaveLength(0);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.removidos).toEqual([]);
    expect(env.alertas).toHaveLength(1);
    const texto = env.alertas[0]!.texto;
    expect(texto).toContain('ya no quedan alias libres');
    expect(texto).not.toContain('Revisa que la pestaña');
    expect(texto).not.toContain('sin_alias');
    expect(texto).not.toContain('D999');
    expect(texto).not.toContain('AAAAAAAAAA');
  });

  it('con el azar atascado: no escribe y el aviso dice que no se pudo generar un código, no que falte la pestaña', () => {
    const env = crearEntorno();
    env.sembrarBytes(...Array.from({ length: 200 }, () => [255]));
    env.fn<() => void>('crearRevisor')();
    expect(nuevas(env)).toHaveLength(0);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.alertas).toHaveLength(1);
    const texto = env.alertas[0]!.texto;
    expect(texto).toContain('no se pudo generar un código nuevo');
    expect(texto).not.toContain('Revisa que la pestaña');
    expect(texto).not.toContain('azar_agotado');
  });

  it('sin el bloqueo: no escribe, no libera lo que no tomó y avisa con un texto fijo', () => {
    const env = crearEntorno();
    env.candado.obtener = false;
    const antes = conteoFilas(env);
    env.fn<() => void>('crearRevisor')();
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.candado.esperas).toEqual([10000]);
    expect(env.candado.liberaciones).toBe(0);
    expect(env.removidos).toEqual([]);
    expect(env.alertas).toHaveLength(1);
    expect(env.alertas[0]!.texto).toContain('ocupada');
    expect(env.alertas[0]!.texto).not.toContain(SITIO);
  });

  it('si la hoja falla al escribir: no hay fila, el aviso es fijo y no trae el mensaje de la excepción', () => {
    const env = crearEntorno();
    env.hojas.Padrón.falla = true;
    env.fn<() => void>('crearRevisor')();
    expect(nuevas(env)).toHaveLength(0);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.alertas[0]!.texto).toContain('No se creó ningún revisor');
    expect(env.alertas[0]!.texto).not.toContain('falla simulada');
  });

  it('si algo falla después de escribir: dice que revises la última fila, sin el código, y libera el bloqueo', () => {
    const env = crearEntorno({ flushFalla: true });
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env)[0]![0]);
    expect(codigo).toMatch(FORMATO);
    expect(env.alertas).toHaveLength(1);
    expect(env.alertas[0]!.texto).toContain('Revisa la última fila');
    expect(env.alertas[0]!.texto).not.toContain(codigo);
    expect(env.alertas[0]!.texto).not.toContain('falla simulada');
    expect(env.candado.liberaciones).toBe(1);
  });

  it('si la caché no responde al borrar, la fila y el enlace salen igual', () => {
    const env = crearEntorno({ removeFalla: true });
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env)[0]![0]);
    expect(env.alertas[0]!.texto).toContain(`${SITIO}/es/revision?r=${codigo}`);
    expect(env.candado.liberaciones).toBe(1);
  });

  it('el código solo sale en la fila y en el enlace del aviso: nada más lo lleva', () => {
    const env = crearEntorno();
    env.fn<() => void>('crearRevisor')();
    const codigo = String(nuevas(env)[0]![0]);
    const sinEnlace = env.alertas[0]!.titulo + env.alertas[0]!.texto.split(codigo).join('');
    expect(sinEnlace).not.toContain(codigo);
    expect(env.alertas[0]!.texto.split(codigo)).toHaveLength(2); // aparece una sola vez
  });
});

describe('crearRevisores: varios a la vez (D3)', () => {
  const crear = (env: Entorno) => env.fn<() => void>('crearRevisores')();

  it('crea 3 bajo un solo bloqueo, con alias consecutivos, códigos distintos y una sola lista en un aviso', () => {
    const env = crearEntorno({ respuestaPrompt: { boton: 'OK', texto: '3' } });
    crear(env);
    const filas = nuevas(env);
    expect(filas.map((f) => f[1])).toEqual(['D05', 'D06', 'D07']);
    expect(filas.map((f) => f[2])).toEqual(['sí', 'sí', 'sí']);
    const codigos = filas.map((f) => String(f[0]));
    expect(new Set(codigos).size).toBe(3);
    for (const c of codigos) expect(c).toMatch(FORMATO);
    expect(env.hojas.Padrón.llamadasSetValues).toBe(1);
    expect(env.candado.esperas).toEqual([10000]);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.candado.escriturasSinCandado).toBe(0);
    expect(env.removidos).toEqual(['padron']);
    expect(env.alertas).toHaveLength(1);
    const lineas = env.alertas[0]!.texto.split('\n');
    filas.forEach((f, i) => expect(lineas[i]).toBe(`${String(f[1])}: ${SITIO}/es/revision?r=${String(f[0])}`));
    expect(env.alertas[0]!.bloqueoTomado).toBe(false);
    expect(env.prompts).toHaveLength(1);
  });

  it('dentro de una misma tanda ningún código se repite: el segundo no puede ser igual al primero', () => {
    const repetido = REPETIDO;
    const env = crearEntorno({ respuestaPrompt: { boton: 'OK', texto: '2' } });
    // El primer código sale de estos 10 resúmenes; los 10 siguientes intentarían dar el mismo.
    env.sembrarBytes(...bytesDe(repetido), ...bytesDe(repetido));
    crear(env);
    const [a, b] = nuevas(env).map((f) => String(f[0]));
    expect(a).toBe(repetido);
    expect(b).not.toBe(repetido);
    expect(b).toMatch(FORMATO);
  });

  it('crea 30 y el valor se recorta y acepta ceros a la izquierda', () => {
    const env = crearEntorno({ respuestaPrompt: { boton: 'OK', texto: ' 30 ' } });
    crear(env);
    expect(nuevas(env)).toHaveLength(30);
    const env2 = crearEntorno({ respuestaPrompt: { boton: 'OK', texto: '02' } });
    crear(env2);
    expect(nuevas(env2)).toHaveLength(2);
  });

  it('Cancelar no escribe nada, ni toma el bloqueo, ni avisa', () => {
    const env = crearEntorno({ respuestaPrompt: { boton: 'CANCEL', texto: '3' } });
    const antes = conteoFilas(env);
    crear(env);
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.candado.esperas).toEqual([]);
    expect(env.alertas).toEqual([]);
    expect(env.removidos).toEqual([]);
  });

  it.each(['abc', '', '0', '31', '100', '1.5', '-1', '3 4', '1e1'])('el valor %j no escribe nada y avisa', (texto) => {
    const env = crearEntorno({ respuestaPrompt: { boton: 'OK', texto } });
    const antes = conteoFilas(env);
    crear(env);
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.candado.esperas).toEqual([]);
    expect(env.alertas).toHaveLength(1);
    expect(env.alertas[0]!.texto).toContain('de 1 a 30');
  });

  it('sin pestaña o sin bloqueo no escribe nada y avisa con un texto fijo', () => {
    const sinPestana = crearEntorno({ sinPestana: 'Padrón', respuestaPrompt: { boton: 'OK', texto: '3' } });
    crear(sinPestana);
    expect(sinPestana.alertas[0]!.texto).not.toContain('sin_pestana');
    expect(sinPestana.alertas[0]!.texto).toContain('No se creó ningún revisor');
    const sinBloqueo = crearEntorno({ respuestaPrompt: { boton: 'OK', texto: '3' } });
    sinBloqueo.candado.obtener = false;
    crear(sinBloqueo);
    expect(nuevas(sinBloqueo)).toHaveLength(0);
    expect(sinBloqueo.alertas[0]!.texto).toContain('ocupada');
  });

  it('si el Padrón ya está en D999 no escribe ninguna fila de la tanda', () => {
    const env = crearEntorno({ padron: [['AAAAAAAAAA', 'D998', 'sí']], respuestaPrompt: { boton: 'OK', texto: '3' } });
    crear(env);
    expect(env.escritas('Padrón')).toHaveLength(1);
    expect(env.alertas[0]!.texto).toContain('No se creó ningún revisor');
    expect(env.candado.liberaciones).toBe(1);
  });
});

describe('el código fuente del script (D9)', () => {
  const fuente = readFileSync(RUTA_SCRIPT, 'utf8');

  it('no usa Math.random, console ni Logger', () => {
    expect(fuente).not.toContain('Math.random');
    expect(fuente).not.toMatch(/\bconsole\./);
    expect(fuente).not.toMatch(/\bLogger\./);
  });

  it('el azar sale de Utilities.computeDigest con SHA-256', () => {
    expect(fuente).toContain('Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256');
    expect(fuente).toContain('/* global SpreadsheetApp, CacheService, LockService, ContentService, Utilities */');
  });

  it('el único enlace es el del sitio, el alfabeto no tiene símbolos confusos y el largo es 10', () => {
    expect(fuente).toContain(`const SITIO = '${SITIO}';`);
    expect(fuente).toContain(`const ALFABETO_CODIGO = '${ALFABETO}';`);
    expect(fuente).toContain('const LARGO_CODIGO = 10;');
    for (const c of '01ILO') expect(ALFABETO).not.toContain(c);
  });

  it('no lleva ningún código de las pruebas', () => {
    for (const c of [CODIGO_ACTIVO, CODIGO_AUSENTE, REPETIDO]) expect(fuente).not.toContain(c);
  });
});
