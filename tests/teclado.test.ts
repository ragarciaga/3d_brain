// Escape: qué hace según el estado y desde dónde se pulsa.
import { describe, expect, it } from 'vitest';
import { accionEscape, esCampoDeTexto } from '../src/lib/teclado';

describe('esCampoDeTexto', () => {
  it.each(['INPUT', 'select', 'Textarea'])('%s es un campo', (tagName) => expect(esCampoDeTexto({ tagName })).toBe(true));
  it('un elemento editable es un campo', () => expect(esCampoDeTexto({ tagName: 'DIV', isContentEditable: true })).toBe(true));
  it('un botón, el cuerpo o nada no son campos', () => {
    expect(esCampoDeTexto({ tagName: 'BUTTON' })).toBe(false);
    expect(esCampoDeTexto({ tagName: 'BODY' })).toBe(false);
    expect(esCampoDeTexto(null)).toBe(false);
  });
});

describe('accionEscape', () => {
  const base = { menuAbierto: false, ubicando: false, aislado: false, enCampo: false };
  it('sale del aislamiento si el foco no está en un campo', () => expect(accionEscape({ ...base, aislado: true })).toBe('salir-aislar'));
  it('dentro de un campo no sale del aislamiento', () => expect(accionEscape({ ...base, aislado: true, enCampo: true })).toBeNull());
  it('cancela la propuesta de posición antes que el aislamiento', () =>
    expect(accionEscape({ ...base, aislado: true, ubicando: true })).toBe('cancelar-ubicar'));
  it('con el cajón abierto lo cierra primero, aunque el foco esté en un campo del cajón', () =>
    expect(accionEscape({ ...base, menuAbierto: true, aislado: true, ubicando: true, enCampo: true })).toBe('cerrar-menu'));
  it('con el armado activo, Escape lo termina', () => expect(accionEscape({ ...base, armando: true })).toBe('terminar-armado'));
  it('con armado y aislamiento, Escape sale solo del armado', () =>
    expect(accionEscape({ ...base, armando: true, aislado: true })).toBe('terminar-armado'));
  it('dentro de un campo no termina el armado', () => expect(accionEscape({ ...base, armando: true, enCampo: true })).toBeNull());
  it('cancelar la propuesta de posición y cerrar el cajón van antes que terminar el armado', () => {
    expect(accionEscape({ ...base, armando: true, ubicando: true })).toBe('cancelar-ubicar');
    expect(accionEscape({ ...base, armando: true, menuAbierto: true })).toBe('cerrar-menu');
  });
  it('sin nada que hacer no hace nada', () => expect(accionEscape(base)).toBeNull());
});
