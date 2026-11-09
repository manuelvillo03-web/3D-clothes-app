// Junta las guías de tallas de data/catalog/marcas en un solo JSON que viaja
// dentro de la app (funciona sin conexión). Los tests validan cada prenda.
//
//   npm run catalog
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '../../data/catalog/marcas');
const out = join(here, '../src/data/catalog.json');

const items = readdirSync(source)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(source, f), 'utf8')));

const ids = new Set();
for (const g of items) {
  if (!g.id) throw new Error(`Prenda sin id: ${g.name}`);
  if (ids.has(g.id)) throw new Error(`id repetido: ${g.id}`);
  ids.add(g.id);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(items, null, 1) + '\n');
console.log(`${items.length} prendas en ${out}`);
