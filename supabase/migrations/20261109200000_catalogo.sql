-- Catálogo compartido de prendas y buzón de aportaciones.
--
-- Principio: aquí no hay datos del cuerpo de nadie. Las medidas de cada
-- usuario viven solo en su móvil. Esta base guarda prendas (tablas de tallas)
-- y lo que los usuarios proponen añadir, que revisamos antes de publicar.

create table public.garments (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  data        jsonb not null,
  brand       text generated always as (data->>'brand') stored,
  name        text generated always as (data->>'name') stored,
  category    text generated always as (data->>'category') stored,
  audience    text generated always as (data->>'audience') stored,
  chart_type  text generated always as (coalesce(data->>'chart_type', 'garment')) stored,
  status      text not null default 'published' check (status in ('published', 'hidden')),
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint garments_data_shape check (
    jsonb_typeof(data) = 'object'
    and data ? 'brand' and data ? 'name' and data ? 'category'
    and jsonb_typeof(data->'sizes') = 'array'
    and jsonb_array_length(data->'sizes') between 1 and 40
    and data->>'id' = id
  )
);

comment on table public.garments is
  'Prendas y guías de tallas del catálogo compartido. data sigue data/catalog/schema.json.';

create index garments_brand_idx on public.garments (brand);
create index garments_category_idx on public.garments (category, audience);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger garments_touch before update on public.garments
  for each row execute function public.touch_updated_at();

alter table public.garments enable row level security;

-- Cualquiera (también sin cuenta) puede leer lo publicado. Nadie escribe
-- desde la app: el catálogo se mantiene con la clave de servicio.
create policy "Leer prendas publicadas" on public.garments
  for select to anon, authenticated
  using (status = 'published');


create table public.garment_submissions (
  id          uuid primary key default gen_random_uuid(),
  data        jsonb not null,
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint submissions_data_shape check (
    jsonb_typeof(data) = 'object'
    and data ? 'brand' and data ? 'name' and data ? 'category'
    and jsonb_typeof(data->'sizes') = 'array'
    and jsonb_array_length(data->'sizes') between 1 and 40
    and pg_column_size(data) < 20000
  )
);

comment on table public.garment_submissions is
  'Prendas que proponen los usuarios. Entran como pending y no se muestran a nadie hasta revisarlas.';

alter table public.garment_submissions enable row level security;

-- Se puede enviar, pero no leer: así nadie ve lo que han enviado otros.
create policy "Enviar prendas para revisión" on public.garment_submissions
  for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null);

-- Freno sencillo contra abusos: como mucho 30 envíos por minuto en total.
create function public.limit_submissions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.garment_submissions
      where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados envíos; inténtalo en un minuto';
  end if;
  return new;
end $$;

revoke execute on function public.limit_submissions() from public, anon, authenticated;

create trigger garment_submissions_limit before insert on public.garment_submissions
  for each row execute function public.limit_submissions();
