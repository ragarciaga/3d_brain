import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string, conAviso = false) {
  if (!conAviso) await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

interface VentanaAtlas {
  __atlas: {
    getState(): {
      aislar: { modo: string } | null;
      seleccion: { entrada: string | null };
      pedirCamara(p: { encuadrar: string[] }): void;
    };
  };
  __camara: { objetivoEnPantalla: (() => { x: number; y: number }) | null };
}

const aislarActual = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().aislar?.modo ?? null);

/** Altura (px del lienzo) a la que la cámara tiene puesto el objetivo; -1 si el visor aún no la da. */
const objetivoY = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaAtlas).__camara.objetivoEnPantalla?.()?.y ?? -1);

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

test('carga el modelo, muestra piezas, cuadros por segundo, aviso educativo y licencia', async ({ page }) => {
  await abrir(page, '/es', true);
  await expect(page.getByRole('dialog', { name: 'Antes de empezar' })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido' }).click();
  await modeloCargado(page);
  await expect(page.getByTestId('fps')).toHaveText(/\d+ cuadros\/s/);
  await expect(page.locator('footer')).toContainText('Uso educativo. No es una herramienta clínica ni de diagnóstico.');
  await page.getByRole('link', { name: 'Fuentes y licencia' }).click();
  await expect(page.getByTestId('licencia')).toContainText('Z-Anatomy');
  await expect(page.getByTestId('licencia')).toContainText('BodyParts3D');
  await expect(page.getByTestId('licencia')).toContainText('CC BY-SA 4.0');
});

test('la interfaz en inglés no muestra textos en español', async ({ page }) => {
  await abrir(page, '/en', true);
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await modeloCargado(page);
  await expect(page.locator('footer')).toContainText('Educational use.');
  await expect(page.getByRole('button', { name: 'Reassemble' })).toBeVisible();
});

test('la pantalla de licencia abierta directo respeta el idioma de la URL', async ({ page }) => {
  await abrir(page, '/en/licencia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sources and license');
  await expect(page.getByRole('link', { name: 'Back to the atlas' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await abrir(page, '/es/licencia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fuentes y licencia');
  await expect(page.getByRole('link', { name: 'Volver al atlas' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('búsqueda bilingüe: con la interfaz en español, "amygdala" abre la amígdala', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await page.getByRole('combobox', { name: /Buscar/ }).fill('amygdala');
  await expect(page.getByRole('option').first()).toContainText('Cuerpo amigdaloide');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/cuerpo-amigdaloide$/);
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'amygdaloid-body');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('neumogastrico');
  await expect(page.getByRole('option').first()).toContainText('Nervio vago');
});

test('URL por estructura e idioma: cambiar de idioma conserva la estructura', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await modeloCargado(page);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await page.getByTestId('cambiar-idioma').click();
  await expect(page).toHaveURL(/\/en\/hippocampus$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hippocampus');
});

test('árbol y grupos: ocultar un grupo y filtrar el sistema límbico', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const encefalo = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') });
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).not.toHaveText('253/253');
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await encefalo.getByRole('checkbox').uncheck();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('0/253');
});

test('"Mostrar todo" deshace piezas ocultas, aislamiento y grupo activo, y solo aparece si hay algo que deshacer', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const encefalo = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') });
  const mostrarTodo = page.getByTestId('mostrar-todo');
  await expect(mostrarTodo).toHaveCount(0);
  // Grupo de estudio activo.
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).not.toHaveText('253/253');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await expect(page.locator('[data-grupo="sistema-limbico"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(mostrarTodo).toHaveCount(0);
  // Piezas ocultas a mano.
  await encefalo.getByRole('checkbox').uncheck();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('0/253');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  // Aislamiento.
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('fragmentar y reensamblar: todas las piezas vuelven exactamente a su sitio', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await page.getByTestId('explosion').fill('70');
  const desplazadas = () =>
    page.evaluate(() => {
      const atlas = (window as unknown as { __atlas: { getState(): { base: Record<string, number[]> } } }).__atlas;
      return Object.values(atlas.getState().base).filter((v) => v.some((x) => x !== 0)).length;
    });
  await expect.poll(desplazadas).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Armar pieza por pieza' }).click();
  await expect(page.getByTestId('contador-armado')).toContainText(/0 de \d+ en su sitio/);
  await page.getByTestId('reensamblar').click();
  await expect.poll(desplazadas).toBe(0);
});

test('modo revisión: el docente marca campos y el contador sube', async ({ page }) => {
  await abrir(page, '/es/revision?r=PRUEBA01');
  await modeloCargado(page);
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Correcto' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Corregir' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).fill('Propuesta de prueba');
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).blur();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  // El texto propuesto no pasa a otra estructura.
  await page.getByRole('combobox', { name: /Buscar/ }).fill('tálamo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/talamo$/);
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Corregir' }).click();
  await expect(page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' })).toHaveValue('');
  await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');
  await page.getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(page.getByRole('dialog', { name: 'Enviar revisión' })).toContainText('Hipocampo');
});

test('tras salir del modo fantasma las piezas se pueden volver a tocar', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await modeloCargado(page);
  await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await page.locator('[data-vista="lateral-izq"]').click();
  await page.waitForTimeout(1500);
  const lienzo = page.getByTestId('visor').locator('canvas');
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page).toHaveURL(/\/es\/[a-z0-9-]+$/);
  await expect(page.getByTestId('ficha')).toBeVisible();
  // Un toque en el visor no mueve el foco a la ficha (solo la búsqueda, el árbol y las relaciones).
  await expect(page.locator('#ficha-titulo')).not.toBeFocused();
});

test('elegir de nuevo la misma estructura después de deseleccionar vuelve a abrir la ficha', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const buscar = page.getByRole('combobox', { name: /Buscar/ });
  await buscar.fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
  await buscar.fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
});

test('volver al inicio desde una estructura (marca o atrás) deja el modo fantasma', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await page.getByRole('link', { name: 'Atlas cerebro y vago' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('ficha')).toHaveCount(0);
  await expect.poll(() => aislarActual(page)).toBeNull();
  // Con el botón atrás del navegador pasa lo mismo.
  await page.getByRole('combobox', { name: /Buscar/ }).fill('tálamo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/talamo$/);
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await page.goBack();
  await expect(page).toHaveURL(/\/es$/);
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('Escape dentro de un campo no sale del aislamiento; fuera de él sí', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await page.getByRole('combobox', { name: /Buscar/ }).focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await aislarActual(page)).toBe('contexto');
  await page.getByRole('combobox', { name: /Buscar/ }).blur();
  await page.keyboard.press('Escape');
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('elegir desde la búsqueda o una relación lleva el foco al título de la ficha', async ({ page }) => {
  await abrir(page, '/es');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  const titulo = page.locator('#ficha-titulo');
  await expect(titulo).toHaveText('Hipocampo');
  await expect(titulo).toBeFocused();
  // Por una relación de la ficha.
  const relacion = page.locator('.relaciones a').first();
  const destino = (await relacion.textContent())!.trim();
  await relacion.click();
  await expect(titulo).toHaveText(new RegExp(destino.split(' (')[0]!));
  await expect(titulo).toBeFocused();
});

test('elegir un nodo del árbol lleva el foco al título de la ficha', async ({ page }) => {
  await abrir(page, '/es');
  const titulo = page.locator('#ficha-titulo');
  await expect(titulo).toHaveCount(0);
  await page.locator('[data-nodo="g-brain"]').click();
  await expect(titulo).toBeVisible();
  await expect(titulo).toBeFocused();
});

test('ruta desconocida: aviso traducido con enlace al inicio; mayúsculas en el slug se aceptan', async ({ page }) => {
  await abrir(page, '/es/no-existe');
  const aviso = page.getByTestId('no-encontrada');
  await expect(aviso).toContainText('No encontramos esa estructura');
  await aviso.getByRole('link', { name: 'Volver al atlas' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('no-encontrada')).toHaveCount(0);
  await abrir(page, '/en/no-existe');
  await expect(page.getByTestId('no-encontrada')).toContainText('We could not find that structure');
  await abrir(page, '/es/HIPOCAMPO');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(page.getByTestId('no-encontrada')).toHaveCount(0);
});

test('marcadores: la fuente de ubicación sale en el idioma de la interfaz y cada marcador tiene su slug', async ({ page }) => {
  await abrir(page, '/en/periaqueductal-grey');
  await expect(page.locator('#ficha-titulo')).toHaveText('Periaqueductal grey');
  await expect(page.getByTestId('ficha')).toContainText('to be verified');
  await expect(page.getByTestId('ficha')).toContainText('surrounds the cerebral aqueduct of the midbrain');
  await expect(page.getByTestId('ficha')).not.toContainText('rodea');
  await expect(page.getByTestId('ficha')).toContainText('Name source: pending confirmation');
  await abrir(page, '/es/sustancia-gris-periacueductal');
  await expect(page.getByTestId('ficha')).toContainText('rodea el acueducto del mesencéfalo');
  await abrir(page, '/es/area-de-wernicke');
  await expect(page.locator('#ficha-titulo')).toHaveText('Área de Wernicke');
});

test('el grupo del vago y la estructura del vago se distinguen en la búsqueda y en la URL', async ({ page }) => {
  await abrir(page, '/es');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('nervio vago');
  const nombres = await page.locator('[role="option"] .res-nombre').allTextContents();
  expect(nombres.length).toBeGreaterThan(1);
  expect(new Set(nombres).size).toBe(nombres.length);
  expect(nombres).toContain('Nervio vago (ambos lados)');
  await abrir(page, '/es/nervio-vago-ambos-lados');
  await expect(page.locator('#ficha-titulo')).toHaveText('Nervio vago (ambos lados)');
  await expect(page.getByTestId('ficha')).toContainText('Fuente del nombre: interfaz');
});

test('si el modelo no carga, el árbol, la búsqueda y las fichas siguen y se puede reintentar', async ({ page }) => {
  await page.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  await abrir(page, '/es');
  const error = page.getByTestId('visor-error');
  await expect(error).toContainText('No se pudo mostrar el modelo 3D');
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Árbol de estructuras' })).toBeVisible();
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(error).toBeVisible();
  // Reintentar vuelve a pedir el modelo (ya sin bloqueo) y monta el visor.
  await page.unroute('**/modelos/atlas.glb');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await modeloCargado(page);
  await expect(page.getByTestId('visor-error')).toHaveCount(0);
});

test('si WebGL falla, solo el visor muestra el error: el árbol y la búsqueda siguen y no sale la página global', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
      if (tipo === 'webgl2' || tipo === 'webgl' || tipo === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await abrir(page, '/es');
  const error = page.getByTestId('visor-error');
  await expect(error).toContainText('No se pudo mostrar el modelo 3D');
  await expect(error.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Árbol de estructuras' })).toBeVisible();
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(error).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
});

test('en escritorio el objetivo del encuadre queda en el centro del visor', async ({ page }) => {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  const alto = (await page.getByTestId('visor').locator('canvas').boundingBox())!.height;
  await expect.poll(async () => Math.abs((await objetivoY(page)) - alto / 2), { timeout: 20_000 }).toBeLessThan(3);
});

test.describe('celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la estructura elegida queda sobre la hoja de la ficha y al cerrarla vuelve al centro', async ({ page }) => {
    await abrir(page, '/es/talamo');
    await modeloCargado(page);
    const lienzo = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
    const hoja = (await page.getByTestId('ficha').boundingBox())!;
    const visible = hoja.y - lienzo.y; // parte del lienzo que la hoja no tapa
    expect(visible).toBeGreaterThan(100);
    expect(visible).toBeLessThan(lienzo.height - 100);
    await expect.poll(async () => Math.abs((await objetivoY(page)) - visible / 2), { timeout: 20_000 }).toBeLessThan(3);
    await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(page.getByTestId('ficha')).toHaveCount(0);
    await expect.poll(async () => Math.abs((await objetivoY(page)) - lienzo.height / 2), { timeout: 20_000 }).toBeLessThan(3);
  });

  test('"Compartir" está en el encabezado del celular', async ({ page }) => {
    await abrir(page, '/es');
    const compartir = page.locator('.compartir-encabezado');
    await expect(compartir).toBeVisible();
    await expect(compartir).toHaveAccessibleName('Compartir');
    await compartir.click();
    await expect(page.locator('.mensaje')).toBeVisible();
  });

  test('el cajón de estructuras cerrado no se enfoca; abre con foco dentro, se cierra con Escape o al elegir', async ({ page }) => {
    await abrir(page, '/es');
    const panel = page.locator('#panel-izq');
    const menu = page.getByRole('button', { name: 'Estructuras', exact: true });
    const focoEnPanel = () => page.evaluate(() => !!document.activeElement?.closest('#panel-izq'));
    // Cerrado: inerte, no se puede enfocar nada de adentro.
    await expect(panel).toHaveAttribute('inert', '');
    const enfocable = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#panel-izq button');
      el?.focus();
      return document.activeElement === el;
    });
    expect(enfocable).toBe(false);
    // Abrir: el foco entra.
    await menu.click();
    await expect(panel).not.toHaveAttribute('inert', '');
    await expect.poll(focoEnPanel).toBe(true);
    // Escape cierra y devuelve el foco al botón.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(menu).toBeFocused();
    // Elegir un grupo de estudio cierra.
    await menu.click();
    await page.locator('[data-grupo="sistema-limbico"]').click();
    await expect(panel).toHaveAttribute('inert', '');
    // ...y el foco vuelve al botón "Estructuras", no a BODY.
    await expect(menu).toBeFocused();
    // Elegir un elemento del árbol cierra.
    await menu.click();
    await page.locator('[data-nodo="g-brain"]').click();
    await expect(panel).toHaveAttribute('inert', '');
    await expect(page.getByTestId('ficha')).toBeVisible();
    // Elegir un resultado de la búsqueda cierra el cajón abierto.
    await menu.click();
    await expect(panel).not.toHaveAttribute('inert', '');
    await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(page).toHaveURL(/\/es\/hipocampo$/);
  });
});

test('modo revisión: "Proponer posición" acepta un toque sobre un órgano de referencia', async ({ page }) => {
  await abrir(page, '/es/revision?r=PRUEBA01');
  await modeloCargado(page);
  await page.getByRole('combobox', { name: /Buscar/ }).fill('sustancia gris periacueductal');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Sustancia gris periacueductal');
  await page.getByRole('button', { name: 'Proponer posición' }).click();
  await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toBeVisible();
  // El estómago es un órgano de referencia: se encuadra y se toca en el centro del visor.
  await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().pedirCamara({ encuadrar: ['stomach'] }));
  await page.waitForTimeout(2500);
  const caja = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toHaveCount(0);
});
