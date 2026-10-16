// scripts/crear-revisores.ts (#185): un padrón que no se puede leer o con JSON roto sale con 2 y un
// mensaje fijo con el rol y la ruta, igual que el importador (#166). Nunca muestra el contenido, el
// mensaje de JSON.parse (cita el texto, con códigos) ni una traza, y no escribe nada.
// Todo corre en carpetas temporales con códigos inventados.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const raiz = resolve('.');
const carpetas: string[] = [];
afterEach(() => {
  while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
});
const temporal = () => {
  const c = mkdtempSync(join(tmpdir(), 'atlas-crear-'));
  carpetas.push(c);
  return c;
};
const correr = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [join(raiz, 'scripts', 'crear-revisores.ts'), ...args], { cwd, encoding: 'utf8' });
const padronEn = (tmp: string) => join(tmp, 'pipeline', 'revisores.local.json');
const enlacesEn = (tmp: string) => join(tmp, 'pipeline', 'salida', 'enlaces-docentes.md');
const conPadron = (texto: string) => {
  const tmp = temporal();
  mkdirSync(join(tmp, 'pipeline'), { recursive: true });
  writeFileSync(padronEn(tmp), texto);
  return tmp;
};
const sinRastro = (r: { stdout: string; stderr: string }) => {
  expect(r.stderr).not.toMatch(/\n\s+at /);
  expect(r.stderr).not.toContain('node:internal');
  expect(r.stderr).not.toContain('Error');
  expect(r.stderr).not.toContain('SyntaxError');
  expect(r.stdout).toBe('');
};

describe('crear-revisores.ts con un padrón que no sirve (#185)', () => {
  // El mensaje de JSON.parse de V8 cita el trozo del texto: si el script lo imprimiera, saldría el código.
  const ROTO = '{"QQSECRETOX":D07}';

  it('el JSON roto de estas pruebas es de los que el mensaje de JSON.parse cita (si no, las pruebas no atraparían nada)', () => {
    let mensaje = '';
    try {
      JSON.parse(ROTO);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toContain('QQSECRETOX');
  });

  it('con JSON roto sale con 2, dice el rol y la ruta, y no imprime códigos, el mensaje del parser ni una traza', () => {
    const tmp = conPadron(ROTO);
    const r = correr(tmp, '2');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(`Padrón inválido (${join('pipeline', 'revisores.local.json')}): no es un JSON válido`);
    for (const c of ['QQSECRETOX', 'D07']) {
      expect(r.stdout).not.toContain(c);
      expect(r.stderr).not.toContain(c);
    }
    expect(r.stderr).not.toMatch(/position|Unexpected|Expected/);
    sinRastro(r);
  });

  it('con JSON roto no cambia el padrón ni escribe enlaces-docentes.md', () => {
    const tmp = conPadron(ROTO);
    const r = correr(tmp, '2');
    expect(r.status).toBe(2);
    expect(readFileSync(padronEn(tmp), 'utf8')).toBe(ROTO);
    expect(existsSync(enlacesEn(tmp))).toBe(false);
    expect(existsSync(join(tmp, 'pipeline', 'salida'))).toBe(false);
  });

  it('si el padrón es una carpeta (no se puede leer) sale con 2 y un mensaje corto con la ruta, sin traza', () => {
    const tmp = temporal();
    mkdirSync(padronEn(tmp), { recursive: true });
    const r = correr(tmp, '2');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(`No se pudo leer el padrón de revisores en ${join('pipeline', 'revisores.local.json')}`);
    sinRastro(r);
    expect(existsSync(enlacesEn(tmp))).toBe(false);
  });

  it('un padrón que es JSON pero no un objeto sigue saliendo con 2 por errorDePadron', () => {
    const tmp = conPadron('["QQSECRETOX"]');
    const r = correr(tmp, '2');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Padrón inválido');
    expect(r.stderr).not.toContain('QQSECRETOX');
    expect(readFileSync(padronEn(tmp), 'utf8')).toBe('["QQSECRETOX"]');
    expect(existsSync(enlacesEn(tmp))).toBe(false);
  });
});

describe('crear-revisores.ts con un padrón que sirve (#185)', () => {
  it('conserva el código que ya estaba, agrega los nuevos con el alias siguiente y escribe los enlaces', () => {
    const tmp = conPadron('{"QQSECRETOX":"D01"}');
    const r = correr(tmp, '2');
    expect(r.status, r.stderr).toBe(0);
    const padron = JSON.parse(readFileSync(padronEn(tmp), 'utf8')) as Record<string, string>;
    expect(padron['QQSECRETOX']).toBe('D01');
    expect(Object.values(padron).sort()).toEqual(['D01', 'D02', 'D03']);
    expect(r.stdout).toContain('2 revisores nuevos (D02, D03)');
    expect(r.stdout).not.toContain('QQSECRETOX');
    const enlaces = readFileSync(enlacesEn(tmp), 'utf8');
    expect(enlaces).toContain('| D01 | QQSECRETOX | https://brain.maysasp.com/es/revision?r=QQSECRETOX |');
  });

  it('sin archivo de padrón lo crea desde cero', () => {
    const tmp = temporal();
    mkdirSync(join(tmp, 'pipeline'), { recursive: true });
    const r = correr(tmp, '1');
    expect(r.status, r.stderr).toBe(0);
    const padron = JSON.parse(readFileSync(padronEn(tmp), 'utf8')) as Record<string, string>;
    expect(Object.values(padron)).toEqual(['D01']);
    expect(existsSync(enlacesEn(tmp))).toBe(true);
  });
});
