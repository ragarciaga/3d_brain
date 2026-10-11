// GitHub Pages no tiene reescrituras: 404.html es una copia de index.html para que las rutas
// profundas (/es/hipocampo) carguen la app (docs/adr/0005-hosting-github-pages.md).
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('dist/404.html creado');
