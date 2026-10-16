// Línea que e2e/canal-real.ts anota por cada petición a Apps Script (#169): método, host y acción, y nunca
// la URL completa, el cuerpo ni el código del revisor. La función es pura y no importa Playwright.
import { describe, expect, it } from 'vitest';
import { lineaDeSalida } from '../e2e/registro-canal';

const CODIGO = 'K7Q2M9XA';
const EXEC = 'https://script.google.com/macros/s/x/exec';
const url = (query = '', base = EXEC) => new URL(`${base}${query}`);

describe('lineaDeSalida', () => {
  it('un POST con la acción en el cuerpo la anota y no deja el código ni la ruta', () => {
    const linea = lineaDeSalida('POST', url(), JSON.stringify({ accion: 'leer', r: CODIGO }));
    expect(linea).toBe('POST script.google.com accion=leer');
    expect(linea).not.toContain(CODIGO);
    expect(linea).not.toContain('/macros/');
  });

  it('un GET con la acción en la query la anota y no deja el código', () => {
    const linea = lineaDeSalida('GET', url(`?accion=leer&r=${CODIGO}`), null);
    expect(linea).toBe('GET script.google.com accion=leer');
    expect(linea).not.toContain(CODIGO);
  });

  it('si el cuerpo y la query difieren, manda el cuerpo', () => {
    expect(lineaDeSalida('POST', url('?accion=leer'), JSON.stringify({ accion: 'guardar' }))).toBe('POST script.google.com accion=guardar');
  });

  it('un cuerpo que no es JSON y sin query deja la acción vacía', () => {
    expect(lineaDeSalida('POST', url(), 'no json')).toBe('POST script.google.com accion=');
  });

  it('un cuerpo null usa la acción de la query', () => {
    expect(lineaDeSalida('POST', url('?accion=autorizar'), null)).toBe('POST script.google.com accion=autorizar');
  });

  it('un cuerpo que no es JSON usa la acción de la query si la hay', () => {
    expect(lineaDeSalida('POST', url('?accion=leer'), 'no json')).toBe('POST script.google.com accion=leer');
  });

  it('una acción con otra forma se anota como ? y no deja su valor', () => {
    const linea = lineaDeSalida('POST', url(), JSON.stringify({ accion: CODIGO }));
    expect(linea).toBe('POST script.google.com accion=?');
    expect(linea).not.toContain(CODIGO);
    expect(lineaDeSalida('GET', url(`?accion=${CODIGO}`), null)).toBe('GET script.google.com accion=?');
    expect(lineaDeSalida('POST', url(), JSON.stringify({ accion: 'a'.repeat(21) }))).toBe('POST script.google.com accion=?');
  });

  it('una acción que no es texto, o un cuerpo que no es un objeto, deja la acción vacía', () => {
    expect(lineaDeSalida('POST', url(), JSON.stringify({ accion: ['leer'] }))).toBe('POST script.google.com accion=');
    expect(lineaDeSalida('POST', url(), '[1]')).toBe('POST script.google.com accion=');
    expect(lineaDeSalida('POST', url(), 'null')).toBe('POST script.google.com accion=');
  });

  it('anota también el host de la redirección de Apps Script', () => {
    const linea = lineaDeSalida('GET', url('?accion=leer', 'https://script.googleusercontent.com/macros/echo'), null);
    expect(linea).toBe('GET script.googleusercontent.com accion=leer');
  });
});
