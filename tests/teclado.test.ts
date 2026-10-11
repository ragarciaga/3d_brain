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
  it('sin nada que hacer no hace nada', () => expect(accionEscape(base)).toBeNull());
});
