# Base de datos (Supabase)

Proyecto `probador`, región `eu-west-3` (París), plan gratuito.

Aquí no hay datos del cuerpo de nadie: solo el catálogo de prendas, las
prendas que proponen los usuarios y valoraciones anónimas de talla.

| Tabla | Quién lee | Quién escribe |
| --- | --- | --- |
| `garments` | Cualquiera, solo lo publicado (`status = 'published'`) | Solo nosotros (clave de servicio o panel) |
| `garment_removals` | Cualquiera | Solo un disparador, cuando una prenda deja de estar publicada o se borra |
| `garment_submissions` | Nadie desde la app | Cualquiera, siempre como `pending`; máximo 30 envíos por minuto en total |
| `fit_feedback` | Nadie desde la app (nosotros, con la vista `fit_feedback_summary`) | Cualquiera; máximo 60 envíos por minuto en total |

La app sincroniza por diferencias: pide las prendas con `updated_at` posterior
al último que recibió y las bajas con `removed_at` posterior. Por eso
`seed.sql` solo toca las filas que han cambiado.

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

## Retirar o corregir una guía

```sql
-- Corregir: las apps la descargan en su siguiente sincronización
update garments set data = jsonb_set(data, '{sizes}', '[...]'::jsonb) where id = '<id>';

-- Retirar: deja de mostrarse también en las apps ya instaladas
update garments set status = 'hidden' where id = '<id>';
```

## Ver las valoraciones

```sql
select * from fit_feedback_summary order by total desc;
```
