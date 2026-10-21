// Credits on the license page (issue #270): the two authors in order with roles in the page language and LinkedIn
// links, the Contribute section, no horizontal overflow on a phone, and the renamed footer link. The 3D model is not
// needed (the page is plain text), so its download is aborted, and any request to a host other than localhost is
// aborted too: this spec never reaches an external site, and no link is clicked.
import { expect, test, type Page } from '@playwright/test';

type Lang = 'es' | 'en';

interface Textos {
  titulo: string;
  enlace: string;
  enlaceViejo: string;
  rafael: { rol: string; otro: string };
  lorena: { rol: string; otro: string };
  repo: string;
  guia: string;
  reportar: string;
}

const TEXTOS: Record<Lang, Textos> = {
  es: {
    titulo: 'Fuentes y licencia',
    enlace: 'Créditos y licencia',
    enlaceViejo: 'Fuentes y licencia',
    rafael: { rol: 'Consultor IA', otro: 'AI Consultant' },
    lorena: { rol: 'Psicóloga en formación', otro: 'Psychologist in training' },
    repo: 'Repositorio en GitHub',
    guia: 'Guía para aportar (en inglés)',
    reportar: 'Reportar un error',
  },
  en: {
    titulo: 'Sources and license',
    enlace: 'Credits and license',
    enlaceViejo: 'Sources and license',
    rafael: { rol: 'AI Consultant', otro: 'Consultor IA' },
    lorena: { rol: 'Psychologist in training', otro: 'Psicóloga en formación' },
    repo: 'GitHub repository',
    guia: 'Contribution guide',
    reportar: 'Report an error',
  },
};

const RAFAEL = { nombre: 'Rafael Andrés García', url: 'https://www.linkedin.com/in/ragarciaga/' };
const LORENA = { nombre: 'Lorena Gómez', url: 'https://www.linkedin.com/in/loregomeza/' };
const URL_REPO = 'https://github.com/ragarciaga/3d_brain';
const URL_GUIA = 'https://github.com/ragarciaga/3d_brain/blob/main/CONTRIBUTING.md';

test.beforeEach(async ({ context }) => {
  await context.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (ruta) => ruta.abort('blockedbyclient'),
  );
});

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

for (const lang of ['es', 'en'] as const) {
  const x = TEXTOS[lang];

  test(`the authors are listed in order with their roles in the page language (${lang})`, async ({ page }) => {
    await abrir(page, `/${lang}/licencia`);
    const autores = page.getByTestId('autor');
    await expect(autores).toHaveCount(2);
    await expect(autores.nth(0)).toContainText(RAFAEL.nombre);
    await expect(autores.nth(0)).toContainText(x.rafael.rol);
    await expect(autores.nth(1)).toContainText(LORENA.nombre);
    await expect(autores.nth(1)).toContainText(x.lorena.rol);
    const texto = await page.getByTestId('licencia').innerText();
    expect(texto).not.toContain(x.rafael.otro);
    expect(texto).not.toContain(x.lorena.otro);
  });

  test(`author names and the Contribute links open in a new tab with noopener noreferrer (${lang})`, async ({ page }) => {
    await abrir(page, `/${lang}/licencia`);
    const pagina = page.getByTestId('licencia');
    const enlaces = [
      { nombre: RAFAEL.nombre, href: RAFAEL.url },
      { nombre: LORENA.nombre, href: LORENA.url },
      { nombre: x.repo, href: URL_REPO },
      { nombre: x.guia, href: URL_GUIA },
    ];
    for (const e of enlaces) {
      const enlace = pagina.getByRole('link', { name: e.nombre, exact: true });
      await expect(enlace, e.nombre).toHaveAttribute('href', e.href);
      await expect(enlace, e.nombre).toHaveAttribute('target', '_blank');
      await expect(enlace, e.nombre).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(pagina).toContainText(x.reportar);
  });

  test(`the license page has no horizontal overflow at 390 x 844 (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page, `/${lang}/licencia`);
    await expect(page.getByTestId('autor')).toHaveCount(2);
    const medidas = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth);
  });

  test(`the footer link reads "${x.enlace}" and opens the license page (${lang})`, async ({ page }) => {
    await abrir(page, `/${lang}`);
    const pie = page.locator('footer');
    const enlace = pie.getByRole('link', { name: x.enlace, exact: true });
    await expect(enlace).toBeVisible();
    await expect(pie.getByRole('link', { name: x.enlaceViejo, exact: true })).toHaveCount(0);
    await enlace.click();
    // The heading first: toHaveURL passes before the view changes.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(x.titulo);
    await expect(page).toHaveURL(new RegExp(`/${lang}/licencia$`));
  });
}
