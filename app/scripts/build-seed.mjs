// Genera supabase/seed.sql con las guías de tallas de data/catalog/marcas.
// Es idempotente: actualiza las que ya existen.
//
//   node scripts/build-seed.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '../../data/catalog/marcas');
const out = join(here, '../../supabase/seed.sql');
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

const rows = readdirSync(source).filter((f) => f.endsWith('.json')).sort().map((f) => {
  const g = JSON.parse(readFileSync(join(source, f), 'utf8'));
  return `  (${q(g.id)}, ${q(JSON.stringify(g))}::jsonb, ${q(g.url ?? g.source ?? '')})`;
});

writeFileSync(out, `-- Generado con app/scripts/build-seed.mjs: no editar a mano.
insert into public.garments (id, data, source) values
${rows.join(',\n')}
on conflict (id) do update set data = excluded.data, source = excluded.source;
`);
console.log(`${rows.length} prendas en ${out}`);
