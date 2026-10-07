-- Aşama 1: mesaj arama (Türkçe tam metin, önek eşleşmeli) + süzgeçler
alter table public.mesajlar add column if not exists arama tsvector generated always as (to_tsvector('turkish', coalesce(metin, ''))) stored;
create index if not exists mesajlar_arama_gin on public.mesajlar using gin (arama);

-- SECURITY INVOKER: mesajlar_oku politikası (üyelik + kanal şifresi) aynen geçerli kalır
create or replace function public.mesaj_ara(
  p_oda uuid, p_sorgu text, p_kanal uuid default null, p_uye uuid default null,
  p_bas timestamptz default null, p_son timestamptz default null, p_ekli boolean default null, p_limit integer default 30
) returns setof public.mesajlar
language plpgsql stable security invoker set search_path to 'public' as
$$
declare temiz text; terimler text; sorgu tsquery;
begin
  temiz := trim(regexp_replace(lower(coalesce(p_sorgu, '')), '[^[:alnum:][:space:]]', ' ', 'g'));
  select string_agg(t || ':*', ' & ') into terimler
    from (select t from unnest(regexp_split_to_array(temiz, '\s+')) t where t <> '' limit 8) x;
  if terimler is not null then sorgu := to_tsquery('turkish', terimler); end if;
  return query
    select m.* from public.mesajlar m
    where public.kanal_odasi(m.kanal_id) = p_oda
      and not m.silindi
      and (sorgu is null or m.arama @@ sorgu)
      and (p_kanal is null or m.kanal_id = p_kanal)
      and (p_uye is null or m.uye_id = p_uye)
      and (p_bas is null or m.olusturma >= p_bas)
      and (p_son is null or m.olusturma < p_son)
      and (p_ekli is null or (m.ek_yol is not null) = p_ekli)
      and (sorgu is not null or p_kanal is not null or p_uye is not null or p_bas is not null or p_son is not null or p_ekli is not null)
    order by m.olusturma desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50);
end $$;
