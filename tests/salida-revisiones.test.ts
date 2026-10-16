// Salida del importador de revisiones (#166): `vaciarSalida` borra solo los .md de primer nivel de
// pipeline/salida/revisiones/ sin seguir enlaces, y el script lo llama después de todas sus validaciones.
// Todo corre en carpetas temporales con códigos falsos de tests/fixtures/revisiones/.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { vaciarSalida } from '../scripts/lib/salida.ts';

const raiz = resolve('.');
const PARTES = ['pipeline', 'salida', 'revisiones'];
const carpetas: string[] = [];
afterEach(() => {
  while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
});
const temporal = () => {
  const c = mkdtempSync(join(tmpdir(), 'atlas-salida-'));
  carpetas.push(c);
  return c;
};
const escribir = (ruta: string, texto = 'x') => {
  mkdirSync(join(ruta, '..'), { recursive: true });
  writeFileSync(ruta, texto);
};
const existe = (ruta: string) => lstatSync(ruta, { throwIfNoEntry: false }) !== undefined;

describe('vaciarSalida (#166)', () => {
  it('sin nada crea los tramos que faltan y no borra ningún archivo', () => {
    const tmp = temporal();
    const r = vaciarSalida(tmp, PARTES);
    expect(r).toEqual({ carpeta: join(tmp, 'pipeline', 'salida', 'revisiones'), borrados: 0 });
    expect(lstatSync(r.carpeta).isDirectory()).toBe(true);
  });

  it('con un solo .md lo borra y cuenta 1', () => {
    const tmp = temporal();
    const viejo = join(tmp, ...PARTES, 'viejo.md');
    escribir(viejo);
    expect(vaciarSalida(tmp, PARTES).borrados).toBe(1);
    expect(existe(viejo)).toBe(false);
  });

  it('borra solo los .md de primer nivel de revisiones y deja todo lo demás', () => {
    const tmp = temporal();
    const rev = join(tmp, ...PARTES);
    const salida = join(tmp, 'pipeline', 'salida');
    // Orden de creación distinto del alfabético, para que una mutación que dependa del orden se note.
    escribir(join(rev, 'sub', 'dentro.md'), 'dentro');
    escribir(join(rev, 'notas.txt'), 'notas');
    escribir(join(rev, 'resumen.md'));
    escribir(join(rev, 'B.MD'));
    escribir(join(rev, 'a.md'));
    escribir(join(salida, 'otro.md'), 'otro');
    escribir(join(salida, 'enlaces-docentes.md'), 'enlaces');
    const r = vaciarSalida(tmp, PARTES);
    expect(r.borrados).toBe(3);
    for (const n of ['a.md', 'B.MD', 'resumen.md']) expect(existe(join(rev, n)), n).toBe(false);
    expect(readFileSync(join(rev, 'notas.txt'), 'utf8')).toBe('notas');
    expect(readFileSync(join(rev, 'sub', 'dentro.md'), 'utf8')).toBe('dentro');
    expect(readFileSync(join(salida, 'enlaces-docentes.md'), 'utf8')).toBe('enlaces');
    expect(readFileSync(join(salida, 'otro.md'), 'utf8')).toBe('otro');
  });

  // Los enlaces de archivo piden permisos de administrador en Windows.
  it.skipIf(process.platform === 'win32')('un .md que es enlace se borra, pero no su destino', () => {
    const tmp = temporal();
    const afuera = join(tmp, 'afuera.md');
    writeFileSync(afuera, 'NO BORRAR');
    const rev = join(tmp, ...PARTES);
    mkdirSync(rev, { recursive: true });
    symlinkSync(afuera, join(rev, 'enlace.md'));
    expect(vaciarSalida(tmp, PARTES).borrados).toBe(1);
    expect(existe(join(rev, 'enlace.md'))).toBe(false);
    expect(readFileSync(afuera, 'utf8')).toBe('NO BORRAR');
  });

  it('si revisiones es un enlace a una carpeta, lanza y no borra nada en el destino', () => {
    const tmp = temporal();
    const destino = join(tmp, 'destino');
    escribir(join(destino, 'x.md'), 'destino');
    mkdirSync(join(tmp, 'pipeline', 'salida'), { recursive: true });
    symlinkSync(destino, join(tmp, ...PARTES), 'junction');
    expect(() => vaciarSalida(tmp, PARTES)).toThrow(/pipeline.salida.revisiones es un enlace o un archivo.*no se borró nada/);
    expect(readFileSync(join(destino, 'x.md'), 'utf8')).toBe('destino');
  });

  it('si el tramo intermedio salida es un enlace, lanza con ese tramo y no borra nada en el destino', () => {
    const tmp = temporal();
    const destino = join(tmp, 'destino');
    escribir(join(destino, 'revisiones', 'y.md'), 'destino');
    mkdirSync(join(tmp, 'pipeline'), { recursive: true });
    symlinkSync(destino, join(tmp, 'pipeline', 'salida'), 'junction');
    let mensaje = '';
    try {
      vaciarSalida(tmp, PARTES);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toMatch(/^pipeline.salida es un enlace o un archivo/);
    expect(mensaje).not.toContain('revisiones');
    expect(readFileSync(join(destino, 'revisiones', 'y.md'), 'utf8')).toBe('destino');
  });

  it('si el primer tramo pipeline es un enlace, lanza y no borra nada', () => {
    const tmp = temporal();
    const destino = join(tmp, 'destino');
    escribir(join(destino, 'salida', 'revisiones', 'z.md'), 'destino');
    symlinkSync(destino, join(tmp, 'pipeline'), 'junction');
    expect(() => vaciarSalida(tmp, PARTES)).toThrow(/^pipeline es un enlace o un archivo/);
    expect(readFileSync(join(destino, 'salida', 'revisiones', 'z.md'), 'utf8')).toBe('destino');
  });

  it('si revisiones es un archivo, lanza y el archivo sigue', () => {
    const tmp = temporal();
    const archivo = join(tmp, ...PARTES);
    escribir(archivo, 'soy un archivo');
    expect(() => vaciarSalida(tmp, PARTES)).toThrow(/es un enlace o un archivo/);
    expect(readFileSync(archivo, 'utf8')).toBe('soy un archivo');
  });
});

describe('importar-revisiones.ts borra los .md de la corrida anterior (#166)', () => {
  const fx = (n: string) => join(raiz, 'tests', 'fixtures', 'revisiones', n);
  const HOJA = fx('hoja-respuestas-vago.csv');
  const PADRON = fx('padron-prueba.json');
  const AUT = fx('hoja-autorizaciones.csv');
  const ESTRUCTURAS =
    '{"estructuras":{"hippocampus":{"ficha":{"version":"0.1.0"}},"m-recurrent-laryngeal-nerve":{"ficha":null},"vagus-nerve-x":{"ficha":{"version":"0.1.0"}}}}';
  const correr = (cwd: string, ...args: string[]) =>
    spawnSync(process.execPath, [join(raiz, 'scripts', 'importar-revisiones.ts'), ...args], { cwd, encoding: 'utf8' });
  const sinCodigos = (r: { stdout: string; stderr: string }) => {
    for (const codigo of ['VAGO01', 'NOVAGO01', 'SINAUT01']) {
      expect(r.stdout).not.toContain(codigo);
      expect(r.stderr).not.toContain(codigo);
    }
  };

  it('una segunda corrida sin --autorizaciones no deja el <id>.md de la primera; una tercera que falla deja la carpeta como estaba', () => {
    const tmp = temporal();
    escribir(join(tmp, 'src', 'data', 'estructuras.json'), ESTRUCTURAS);
    const rev = join(tmp, ...PARTES);
    const enlaces = join(tmp, 'pipeline', 'salida', 'enlaces-docentes.md');
    escribir(enlaces, 'enlaces');

    const uno = correr(tmp, HOJA, PADRON, '--autorizaciones', AUT);
    expect(uno.status, uno.stderr).toBe(0);
    for (const n of ['m-recurrent-laryngeal-nerve.md', 'vagus-nerve-x.md', 'hippocampus.md', 'resumen.md']) expect(existe(join(rev, n)), n).toBe(true);
    expect(uno.stdout).toContain('1 respuestas de revisores sin ninguna autorización');
    expect(uno.stdout).toContain(`Resumen: ${join('pipeline', 'salida', 'revisiones', 'resumen.md')}`);
    expect(uno.stdout).toContain('D93');
    expect(readFileSync(join(rev, 'resumen.md'), 'utf8')).toContain('Hay 1 respuestas de revisores sin ninguna autorización en `Autorizaciones`.');
    sinCodigos(uno);

    const dos = correr(tmp, HOJA, PADRON);
    expect(dos.status, dos.stderr).toBe(0);
    expect(existe(join(rev, 'm-recurrent-laryngeal-nerve.md'))).toBe(false);
    expect(existe(join(rev, 'vagus-nerve-x.md'))).toBe(true);
    expect(dos.stdout).not.toContain('sin ninguna autorización');
    expect(readFileSync(join(rev, 'resumen.md'), 'utf8')).not.toContain('sin ninguna autorización');
    expect(dos.stderr).toContain('Sin --autorizaciones');
    expect(readFileSync(enlaces, 'utf8')).toBe('enlaces');
    sinCodigos(dos);

    const resumenAntes = readFileSync(join(rev, 'resumen.md'), 'utf8');
    const tres = correr(tmp, HOJA, join(tmp, 'no-existe.json'));
    expect(tres.status).toBe(2);
    expect(readFileSync(join(rev, 'resumen.md'), 'utf8')).toBe(resumenAntes);
    expect(existe(join(rev, 'vagus-nerve-x.md'))).toBe(true);
    sinCodigos(tres);
  });

  describe('una entrada que no se puede leer sale con 2, un mensaje corto y la carpeta intacta', () => {
    /** Una corrida buena deja resúmenes; devuelve la carpeta y su contenido para comparar después de la corrida que falla. */
    const conCorridaBuena = () => {
      const tmp = temporal();
      escribir(join(tmp, 'src', 'data', 'estructuras.json'), ESTRUCTURAS);
      const rev = join(tmp, ...PARTES);
      const buena = correr(tmp, HOJA, PADRON, '--autorizaciones', AUT);
      expect(buena.status, buena.stderr).toBe(0);
      const nombres = ['m-recurrent-laryngeal-nerve.md', 'vagus-nerve-x.md', 'hippocampus.md', 'resumen.md'];
      const antes = nombres.map((n) => readFileSync(join(rev, n), 'utf8'));
      const igual = () => nombres.every((n, i) => existe(join(rev, n)) && readFileSync(join(rev, n), 'utf8') === antes[i]);
      return { tmp, igual };
    };
    const sinRastro = (r: { stdout: string; stderr: string }) => {
      expect(r.stderr).not.toMatch(/\n\s+at /);
      expect(r.stderr).not.toContain('node:internal');
      expect(r.stderr).not.toContain('Error:');
      expect(r.stdout).toBe('');
    };

    it('si falta el CSV de respuestas: sale con 2, sin traza de Node y con los resúmenes byte a byte iguales', () => {
      const { tmp, igual } = conCorridaBuena();
      const r = correr(tmp, join(tmp, 'no-existe.csv'), PADRON, '--autorizaciones', AUT);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('No está el CSV de respuestas');
      expect(r.stderr).toContain('no-existe.csv');
      sinRastro(r);
      sinCodigos(r);
      expect(igual()).toBe(true);
    });

    it('si el padrón no es un JSON válido: sale con 2 y ni stdout ni stderr traen los códigos del archivo', () => {
      const { tmp, igual } = conCorridaBuena();
      const roto = join(tmp, 'padron-roto.json');
      // El error de V8 cita la entrada solo con un token inesperado: así un `e.message` impreso traería el código.
      const texto = '{"QQSECRETOX":D07}';
      expect(() => JSON.parse(texto)).toThrow(/QQSECRETOX/);
      escribir(roto, texto);
      const r = correr(tmp, HOJA, roto, '--autorizaciones', AUT);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('no es un JSON válido');
      expect(r.stdout).not.toContain('QQSECRETOX');
      expect(r.stderr).not.toContain('QQSECRETOX');
      sinRastro(r);
      expect(igual()).toBe(true);
    });

    it('si un código del padrón es inválido: lo dice por su posición y su alias, sin imprimir el código', () => {
      const { tmp, igual } = conCorridaBuena();
      const malo = join(tmp, 'padron-malo.json');
      escribir(malo, '{"QQBUENOXYZ":"D01","QQTYPO XYZ":"D02"}');
      const r = correr(tmp, HOJA, malo, '--autorizaciones', AUT);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('código inválido en la entrada 2 del padrón (alias D02)');
      for (const c of ['QQBUENO', 'QQTYPO']) {
        expect(r.stdout).not.toContain(c);
        expect(r.stderr).not.toContain(c);
      }
      sinRastro(r);
      expect(igual()).toBe(true);
    });

    it('si el CSV de Autorizaciones es una carpeta: sale con 2 y un mensaje corto', () => {
      const { tmp, igual } = conCorridaBuena();
      const r = correr(tmp, HOJA, PADRON, '--autorizaciones', tmp);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('No se pudo leer');
      sinRastro(r);
      expect(igual()).toBe(true);
    });
  });

  it.skipIf(process.platform === 'win32')('si pipeline/salida/revisiones es un enlace, sale con 2, lo dice y no borra en el destino', () => {
    const tmp = temporal();
    escribir(join(tmp, 'src', 'data', 'estructuras.json'), ESTRUCTURAS);
    const destino = join(tmp, 'destino');
    escribir(join(destino, 'x.md'), 'destino');
    mkdirSync(join(tmp, 'pipeline', 'salida'), { recursive: true });
    symlinkSync(destino, join(tmp, ...PARTES), 'dir');
    const r = correr(tmp, HOJA, PADRON, '--autorizaciones', AUT);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('es un enlace o un archivo');
    expect(readFileSync(join(destino, 'x.md'), 'utf8')).toBe('destino');
    expect(existsSync(join(destino, 'resumen.md'))).toBe(false);
    sinCodigos(r);
  });
});
