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
  const base = {
    confirmandoSalida: false,
    dialogoReporte: false,
    dialogoRevision: false,
    menuAbierto: false,
    cortesAbierto: false,
    ubicando: false,
    aislado: false,
    enCampo: false,
  };
  it('con el diálogo de reportar un error abierto, Escape lo cierra', () =>
    expect(accionEscape({ ...base, dialogoReporte: true })).toBe('cerrar-reporte'));
  it('el diálogo de reporte va antes que todo salvo la confirmación de salida', () =>
    expect(
      accionEscape({
        confirmandoSalida: false,
        dialogoReporte: true,
        dialogoRevision: true,
        menuAbierto: true,
        cortesAbierto: true,
        ubicando: true,
        aislado: true,
        enCampo: true,
      }),
    ).toBe('cerrar-reporte'));
  it('la confirmación de salida va antes que el diálogo de reporte', () =>
    expect(accionEscape({ ...base, confirmandoSalida: true, dialogoReporte: true })).toBe('cancelar-salida'));
  it('el diálogo de reporte va antes que el de revisión', () =>
    expect(accionEscape({ ...base, dialogoReporte: true, dialogoRevision: true })).toBe('cerrar-reporte'));
  it('el diálogo de reporte se cierra aunque el foco esté en un campo y haya aislamiento', () =>
    expect(accionEscape({ ...base, dialogoReporte: true, aislado: true, enCampo: true })).toBe('cerrar-reporte'));
  it('con un diálogo de revisión abierto, Escape lo cierra', () =>
    expect(accionEscape({ ...base, dialogoRevision: true })).toBe('cerrar-revision'));
  it('sin confirmación de salida, el diálogo de revisión va antes que cualquier otra acción salvo el diálogo de reporte', () =>
    expect(
      accionEscape({
        confirmandoSalida: false,
        dialogoReporte: false,
        dialogoRevision: true,
        menuAbierto: true,
        cortesAbierto: true,
        ubicando: true,
        aislado: true,
        enCampo: true,
      }),
    ).toBe('cerrar-revision'));
  it('con la confirmación de salida abierta, Escape la cancela antes que todo', () =>
    expect(
      accionEscape({
        confirmandoSalida: true,
        dialogoReporte: true,
        dialogoRevision: true,
        menuAbierto: true,
        cortesAbierto: true,
        ubicando: true,
        aislado: true,
        enCampo: false,
      }),
    ).toBe('cancelar-salida'));
  it('la confirmación va antes que un diálogo de revisión abierto', () =>
    expect(accionEscape({ ...base, confirmandoSalida: true, dialogoRevision: true })).toBe('cancelar-salida'));
  it('la confirmación se cancela aunque el foco esté en un campo', () =>
    expect(accionEscape({ ...base, confirmandoSalida: true, enCampo: true })).toBe('cancelar-salida'));
  it('con el foco en un campo dentro del diálogo también lo cierra', () =>
    expect(accionEscape({ ...base, dialogoRevision: true, enCampo: true })).toBe('cerrar-revision'));
  it('sin diálogo, el cajón sigue primero', () =>
    expect(accionEscape({ ...base, menuAbierto: true, aislado: true })).toBe('cerrar-menu'));
  it('sale del aislamiento si el foco no está en un campo', () => expect(accionEscape({ ...base, aislado: true })).toBe('salir-aislar'));
  it('dentro de un campo no sale del aislamiento', () => expect(accionEscape({ ...base, aislado: true, enCampo: true })).toBeNull());
  it('cancela la propuesta de posición antes que el aislamiento', () =>
    expect(accionEscape({ ...base, aislado: true, ubicando: true })).toBe('cancelar-ubicar'));
  it('con el cajón abierto lo cierra primero, aunque el foco esté en un campo del cajón', () =>
    expect(accionEscape({ ...base, menuAbierto: true, aislado: true, ubicando: true, enCampo: true })).toBe('cerrar-menu'));
  it('con el panel de cortes abierto y nada más, Escape lo cierra', () =>
    expect(accionEscape({ ...base, cortesAbierto: true })).toBe('cerrar-cortes'));
  it('el panel de cortes se cierra antes de salir del aislamiento', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, aislado: true })).toBe('cerrar-cortes'));
  it('el panel de cortes se cierra aunque el foco esté en su deslizador (un campo)', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, aislado: true, enCampo: true })).toBe('cerrar-cortes'));
  it('el panel de cortes se cierra antes de cancelar la propuesta de posición', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, ubicando: true })).toBe('cerrar-cortes'));
  it('con el cajón y el panel de cortes abiertos, el cajón va primero', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, menuAbierto: true })).toBe('cerrar-menu'));
  it('con un diálogo de revisión y el panel de cortes abiertos, el diálogo va primero', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, dialogoRevision: true })).toBe('cerrar-revision'));
  it('con la confirmación de salida y el panel de cortes abiertos, la confirmación va primero', () =>
    expect(accionEscape({ ...base, cortesAbierto: true, confirmandoSalida: true })).toBe('cancelar-salida'));
  it('sin el panel de cortes, el aislamiento se sale como antes', () =>
    expect(accionEscape({ ...base, cortesAbierto: false, aislado: true })).toBe('salir-aislar'));
  it('sin nada que hacer no hace nada', () => expect(accionEscape(base)).toBeNull());
});
