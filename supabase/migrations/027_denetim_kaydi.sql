-- Aşama 4: denetim kaydı. Yöneticilerin eylemleri veritabanı tetikleyicileriyle otomatik yazılır; yalnızca yetkililer okur.
-- Servis anahtarıyla yapılan eylemler (üye atma, yasaklama, sesten atma) `yonet` edge function'ı tarafından yazılır.
create table if not exists public.denetim_kaydi (
  id bigserial primary key,
  oda_id uuid not null references public.odalar(id) on delete cascade,
  eyleyen uuid references public.uyeler(id) on delete set null,
  eylem text not null check (char_length(eylem) between 1 and 40),
  hedef text check (hedef is null or char_length(hedef) <= 80),
  ayrinti jsonb not null default '{}'::jsonb,
  zaman timestamptz not null default now()
);
create index if not exists denetim_kaydi_oda_zaman on public.denetim_kaydi (oda_id, zaman desc);
alter table public.denetim_kaydi enable row level security;
-- Okuma: mesaj_yonet (16) | sustur (32) | yasakla (64) | kanal_yonet (128) izinlerinden biri
drop policy if exists denetim_kaydi_oku on public.denetim_kaydi;
create policy denetim_kaydi_oku on public.denetim_kaydi for select to authenticated using ((izinlerim(oda_id) & 240) <> 0);

-- Şu anki kullanıcının bu sunucudaki üye kimliği
create or replace function public.benim_uyem_oda(p_oda uuid) returns uuid language sql stable security definer set search_path to 'public' as
$$ select id from public.uyeler where oda_id = p_oda and user_id = auth.uid() and not silindi limit 1; $$;

create or replace function public.denetim_yaz(p_oda uuid, p_eylem text, p_hedef text, p_ayrinti jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  insert into public.denetim_kaydi (oda_id, eyleyen, eylem, hedef, ayrinti)
  values (p_oda, public.benim_uyem_oda(p_oda), p_eylem, left(p_hedef, 80), coalesce(p_ayrinti, '{}'::jsonb));
end $$;

-- Başkasının mesajını silme (kendi mesajını silmek kayda girmez)
create or replace function public.denetim_mesaj() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_ben uuid;
begin
  if new.silindi and not old.silindi and auth.uid() is not null then
    v_oda := public.kanal_odasi(new.kanal_id);
    v_ben := public.benim_uyem_oda(v_oda);
    if v_ben is not null and v_ben <> new.uye_id then
      perform public.denetim_yaz(v_oda, 'mesaj_sil', (select takma_ad from public.uyeler where id = new.uye_id), jsonb_build_object('kanal', (select ad from public.kanallar where id = new.kanal_id)));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists denetim_mesaj_tr on public.mesajlar;
drop trigger if exists denetim_mesaj_tr on public.mesajlar;
create trigger denetim_mesaj_tr after update of silindi on public.mesajlar for each row execute function public.denetim_mesaj();

-- Susturma ve rol değişikliği
create or replace function public.denetim_uye() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is null or public.benim_uyem_oda(new.oda_id) is not distinct from new.id then return new; end if;
  if new.susturma_bitis is distinct from old.susturma_bitis then
    perform public.denetim_yaz(new.oda_id, case when new.susturma_bitis is null or new.susturma_bitis <= now() then 'sustur_kaldir' else 'sustur' end, new.takma_ad,
      jsonb_build_object('bitis', new.susturma_bitis));
  end if;
  if new.rol is distinct from old.rol then
    perform public.denetim_yaz(new.oda_id, 'rol_degis', new.takma_ad, jsonb_build_object('eski', old.rol, 'yeni', new.rol));
  end if;
  return new;
end $$;
drop trigger if exists denetim_uye_tr on public.uyeler;
drop trigger if exists denetim_uye_tr on public.uyeler;
create trigger denetim_uye_tr after update of susturma_bitis, rol on public.uyeler for each row execute function public.denetim_uye();

create or replace function public.denetim_uye_rolu() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare v_uye uuid := coalesce(new.uye_id, old.uye_id); v_rol uuid := coalesce(new.rol_id, old.rol_id); v_oda uuid;
begin
  select oda_id into v_oda from public.uyeler where id = v_uye;
  if v_oda is not null and auth.uid() is not null then
    perform public.denetim_yaz(v_oda, case when tg_op = 'INSERT' then 'rol_ver' else 'rol_al' end, (select takma_ad from public.uyeler where id = v_uye),
      jsonb_build_object('rol', (select ad from public.roller where id = v_rol)));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_uye_rolu_tr on public.uye_rolleri;
drop trigger if exists denetim_uye_rolu_tr on public.uye_rolleri;
create trigger denetim_uye_rolu_tr after insert or delete on public.uye_rolleri for each row execute function public.denetim_uye_rolu();

create or replace function public.denetim_rol() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare r public.roller := coalesce(new, old);
begin
  if auth.uid() is not null then
    perform public.denetim_yaz(r.oda_id, case tg_op when 'INSERT' then 'rol_olustur' when 'UPDATE' then 'rol_guncelle' else 'rol_sil' end, r.ad,
      case when tg_op = 'UPDATE' then jsonb_build_object('izinler', new.izinler) else '{}'::jsonb end);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_rol_tr on public.roller;
drop trigger if exists denetim_rol_tr on public.roller;
create trigger denetim_rol_tr after insert or update or delete on public.roller for each row execute function public.denetim_rol();

create or replace function public.denetim_kanal() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then perform public.denetim_yaz(new.oda_id, 'kanal_ekle', new.ad, jsonb_build_object('tur', new.tur));
  elsif tg_op = 'DELETE' then perform public.denetim_yaz(old.oda_id, 'kanal_sil', old.ad, jsonb_build_object('tur', old.tur));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_kanal_tr on public.kanallar;
drop trigger if exists denetim_kanal_tr on public.kanallar;
create trigger denetim_kanal_tr after insert or delete on public.kanallar for each row execute function public.denetim_kanal();

create or replace function public.denetim_davet() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is not null then perform public.denetim_yaz(new.oda_id, 'davet_olustur', new.kod, jsonb_build_object('bitis', new.bitis, 'limit', new.kullanim_limiti)); end if;
  return new;
end $$;
drop trigger if exists denetim_davet_tr on public.davetler;
drop trigger if exists denetim_davet_tr on public.davetler;
create trigger denetim_davet_tr after insert on public.davetler for each row execute function public.denetim_davet();

create or replace function public.denetim_oda() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is not null and (new.ad is distinct from old.ad or new.herkes_izin is distinct from old.herkes_izin or new.moderator_izin is distinct from old.moderator_izin) then
    perform public.denetim_yaz(new.id, 'sunucu_ayar', new.ad, jsonb_build_object('herkes', new.herkes_izin, 'moderator', new.moderator_izin));
  end if;
  return new;
end $$;
drop trigger if exists denetim_oda_tr on public.odalar;
drop trigger if exists denetim_oda_tr on public.odalar;
create trigger denetim_oda_tr after update on public.odalar for each row execute function public.denetim_oda();

revoke execute on function public.benim_uyem_oda(uuid), public.denetim_yaz(uuid, text, text, jsonb) from public, anon;
grant execute on function public.benim_uyem_oda(uuid) to authenticated;
revoke execute on function public.denetim_mesaj(), public.denetim_uye(), public.denetim_uye_rolu(), public.denetim_rol(), public.denetim_kanal(), public.denetim_davet(), public.denetim_oda() from public, anon, authenticated;
