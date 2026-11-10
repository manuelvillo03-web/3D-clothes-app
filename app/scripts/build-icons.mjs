/**
 * Genera los iconos de la app a partir de un único dibujo (la etiqueta de
 * talla con la cinta métrica). Necesita Playwright; solo hace falta volver a
 * ejecutarlo si cambia la identidad:  node scripts/build-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const font = readFileSync(resolve(root, 'node_modules/@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf')).toString('base64');

const INDIGO = '#1D2257';
const TAPE = '#FFD43A';

/** Etiqueta colgante con marcas de cinta y la P de Probador. `scale` deja margen de seguridad. */
function tag({ fill, ink, scale = 1 }) {
  const ticks = [];
  for (let i = 0; i < 9; i++) {
    const y = 420 + i * 44;
    ticks.push(`<rect x="292" y="${y}" width="${i % 2 === 0 ? 62 : 36}" height="12" rx="6" fill="${ink}"/>`);
  }
  return `<g transform="translate(512 512) scale(${scale}) rotate(-8) translate(-512 -512)">
    <rect x="262" y="170" width="500" height="684" rx="64" fill="${fill}"/>
    <path d="M262 290 a120 120 0 0 1 120 -120 h260 a120 120 0 0 1 120 120 v40 h-500 z" fill="${fill}"/>
    <circle cx="512" cy="276" r="38" fill="${ink}"/>
    ${ticks.join('')}
    <text x="556" y="760" text-anchor="middle" font-family="Barlow" font-weight="700" font-size="430" fill="${ink}">P</text>
  </g>`;
}

const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <style>@font-face{font-family:Barlow;font-weight:700;src:url(data:font/ttf;base64,${font})}</style>
  ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`;

const FILES = [
  ['icon.png', 1024, svg(tag({ fill: TAPE, ink: INDIGO, scale: 0.92 }), INDIGO)],
  ['android-icon-foreground.png', 1024, svg(tag({ fill: TAPE, ink: INDIGO, scale: 0.62 }))],
  ['android-icon-background.png', 1024, svg('', INDIGO)],
  ['android-icon-monochrome.png', 1024, svg(tag({ fill: '#FFFFFF', ink: 'rgba(0,0,0,0)', scale: 0.62 }))],
  ['splash-icon.png', 1024, svg(tag({ fill: TAPE, ink: INDIGO, scale: 0.8 }))],
  ['favicon.png', 96, svg(tag({ fill: TAPE, ink: INDIGO, scale: 0.98 }), INDIGO)],
];

const browser = await chromium.launch();
for (const [name, size, markup] of FILES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${markup.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'assets', name), omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`${FILES.length} iconos generados en assets/`);
