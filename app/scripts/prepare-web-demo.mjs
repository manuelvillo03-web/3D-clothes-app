// Prepara la exportación web (dist/) para publicarla como página de prueba:
// rutas relativas (la página no vive en la raíz del dominio) y un index.html
// sin <html>/<head>/<body>, que pone el alojamiento.
//
//   npx expo export -p web && node scripts/prepare-web-demo.mjs [salida]
import { cpSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const src = 'dist';
const out = process.argv[2] ?? 'dist-demo';
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// El alojamiento reserva los nombres que empiezan por «_».
renameSync(join(out, '_expo'), join(out, 'expo'));

// Tampoco sirve archivos .bin: el maniquí (bytes que la app lee con fetch)
// se publica con la extensión de otro binario servido. Nadie lo ejecuta.
const renamed = [];
for (const file of walk(join(out, 'assets'))) {
  if (file.endsWith('.bin')) {
    renameSync(file, `${file}.wasm`);
    renamed.push(relative(out, file));
  }
}

for (const file of walk(join(out, 'expo'))) {
  if (!file.endsWith('.js')) continue;
  let js = readFileSync(file, 'utf8').replaceAll('"/assets/', '"./assets/');
  for (const r of renamed) js = js.replaceAll(`"./${r}"`, `"./${r}.wasm"`);
  writeFileSync(file, js);
}

const html = readFileSync(join(src, 'index.html'), 'utf8');
const style = html.match(/<style id="expo-reset">[\s\S]*?<\/style>/)[0];
const scripts = [...html.matchAll(/<script src="\/(_expo\/[^"]+)" defer><\/script>/g)].map((m) => m[1]);
const page = `<title>Probador</title>
${style.replace('</style>', `
      html { box-sizing: border-box; background: #1D2257; }
      body { background: #1D2257; color: #171A33; }
    </style>`)}
<noscript>Hace falta JavaScript para usar Probador.</noscript>
<div id="root"></div>
<script>
  // Fija la carpeta de la página antes de que el enrutador cambie la ruta:
  // así los recursos relativos (maniquí, iconos) siempre se encuentran.
  (function () {
    try {
      var b = document.createElement('base');
      b.href = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
      document.head.appendChild(b);
    } catch (e) {}
  })();
</script>
${scripts.map((s) => `<script src="./${s.replace(/^_expo\//, 'expo/')}" defer></script>`).join('\n')}
`;
writeFileSync(join(out, 'index.html'), page);
rmSync(join(out, 'metadata.json'), { force: true });

const files = walk(out).map((f) => relative(out, f)).filter((f) => f !== 'index.html');
console.log(JSON.stringify(files));
