-- Sincronización incremental del catálogo y valoraciones anónimas de talla.
--
-- 1. La app guarda el catálogo en el móvil y solo pide lo que ha cambiado
--    desde la última vez (updated_at > última sincronización). Para que
--    también se entere de lo que se retira, cada prenda que deja de estar
--    publicada o se borra deja una «baja» con su id.
-- 2. Quien compra una prenda puede decir, si quiere, cómo le quedó la talla.
--    Es anónimo: prenda, talla y respuesta. Nada sobre el cuerpo de nadie.

-- ---------------------------------------------------------------- catálogo

-- La consulta de sincronización: publicadas, por fecha de cambio.
create index garments_published_updated_idx on public.garments (updated_at)
  where status = 'published';

create table public.garment_removals (
  id          text primary key,
  removed_at  timestamptz not null default now()
);

comment on table public.garment_removals is
  'Ids de prendas retiradas del catálogo, para que las apps las quiten de su copia local.';

create index garment_removals_removed_idx on public.garment_removals (removed_at);

alter table public.garment_removals enable row level security;

create policy "Leer bajas del catálogo" on public.garment_removals
  for select to anon, authenticated
  using (true);

create function public.track_garment_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into public.garment_removals (id) values (old.id)
      on conflict (id) do update set removed_at = now();
    return old;
  end if;
  if new.status = 'published' then
    delete from public.garment_removals where id = new.id;
  elsif tg_op = 'INSERT' or old.status = 'published' then
    insert into public.garment_removals (id) values (new.id)
      on conflict (id) do update set removed_at = now();
  end if;
  return new;
end $$;

revoke execute on function public.track_garment_removal() from public, anon, authenticated;

create trigger garments_track_removal
  after insert or delete or update of status on public.garments
  for each row execute function public.track_garment_removal();

-- ------------------------------------------------------------ valoraciones

create table public.fit_feedback (
  id                bigint generated always as identity primary key,
  garment_id        text not null references public.garments (id) on delete cascade,
  size_label        text not null check (length(size_label) between 1 and 16),
  recommended_label text check (recommended_label is null or length(recommended_label) between 1 and 16),
  verdict           text not null check (verdict in ('small', 'right', 'large')),
  engine_version    text check (engine_version is null or length(engine_version) <= 20),
  -- Solo el día: una hora exacta no aporta nada y ayudaría a identificar a alguien.
  created_on        date not null default current_date
);

comment on table public.fit_feedback is
  'Cómo le quedó una talla a quien la compró (anónimo y voluntario). Sin medidas ni identificadores.';

create index fit_feedback_garment_idx on public.fit_feedback (garment_id, size_label);

alter table public.fit_feedback enable row level security;

-- Se puede enviar, pero no leer.
create policy "Enviar valoración de talla" on public.fit_feedback
  for insert to anon, authenticated
  with check (created_on = current_date);

-- Mismo freno que en las aportaciones: como mucho 60 valoraciones por minuto en total.
create table public.fit_feedback_rate (
  minute  timestamptz primary key,
  count   integer not null default 0
);

alter table public.fit_feedback_rate enable row level security;

create function public.limit_fit_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.fit_feedback_rate (minute, count) values (date_trunc('minute', now()), 1)
    on conflict (minute) do update set count = public.fit_feedback_rate.count + 1
    returning count into n;
  if n > 60 then
    raise exception 'Demasiados envíos; inténtalo en un minuto';
  end if;
  delete from public.fit_feedback_rate where minute < now() - interval '1 hour';
  return new;
end $$;

revoke execute on function public.limit_fit_feedback() from public, anon, authenticated;

create trigger fit_feedback_limit before insert on public.fit_feedback
  for each row execute function public.limit_fit_feedback();

-- Resumen para nosotros (panel de Supabase): qué prendas tallan pequeño o grande.
create view public.fit_feedback_summary with (security_invoker = true) as
select garment_id, size_label,
       count(*) filter (where verdict = 'small') as small,
       count(*) filter (where verdict = 'right') as right_size,
       count(*) filter (where verdict = 'large') as large,
       count(*) as total
from public.fit_feedback
group by garment_id, size_label;
