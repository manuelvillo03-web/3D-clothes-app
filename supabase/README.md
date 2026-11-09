# Base de datos (Supabase)

Proyecto `probador`, región `eu-west-3` (París), plan gratuito.

Aquí no hay datos del cuerpo de nadie: solo el catálogo de prendas y las
prendas que proponen los usuarios.

| Tabla | Quién lee | Quién escribe |
| --- | --- | --- |
| `garments` | Cualquiera, solo lo publicado (`status = 'published'`) | Solo nosotros (clave de servicio o panel) |
| `garment_submissions` | Nadie desde la app | Cualquiera, siempre como `pending`; máximo 30 envíos por minuto en total |

## Archivos

- `migrations/`: esquema y políticas de seguridad por fila, en orden.
- `seed.sql`: guías de tallas de `data/catalog/marcas`. Se genera con
  `node app/scripts/build-seed.mjs`; el CI de la app comprueba que está al día.

## Revisar aportaciones

En el editor SQL de Supabase:

```sql
-- Pendientes
select id, created_at, data->>'brand' as marca, data->>'name' as prenda, note
from garment_submissions where status = 'pending' order by created_at;

-- Publicar una (revisada a mano)
insert into garments (id, data, source)
select 'comunidad-' || left(id::text, 8),
       jsonb_set(data, '{id}', to_jsonb('comunidad-' || left(id::text, 8))),
       'Aportación de usuario revisada'
from garment_submissions where id = '<uuid>';
update garment_submissions set status = 'accepted', reviewed_at = now() where id = '<uuid>';
```
