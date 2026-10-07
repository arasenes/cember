-- Kanal bazlı izin geçersiz kılma (Discord "kanal izinleri"): bir kanalda Herkes / Moderatör / özel rol için
-- mesaj_yaz (1), dosya (2), ses_konus (4), ekran_kamera (8) izinleri verilebilir ya da kısılabilir.
-- Etkin kanal izni: sunucu izni → "Herkes" geçersiz kılması → üyenin rollerinin geçersiz kılmaları (önce kısıt, sonra izin). Sahip her şeyi yapar.

create table if not exists public.kanal_izinleri (
  id uuid primary key default gen_random_uuid(),
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  hedef text not null check (hedef in ('herkes', 'moderator', 'rol')),
  rol_id uuid references public.roller(id) on delete cascade,
  ver bigint not null default 0 check (ver >= 0 and ver < 16),
  yasak bigint not null default 0 check (yasak >= 0 and yasak < 16),
  check ((hedef = 'rol') = (rol_id is not null))
);
create unique index if not exists kanal_izinleri_hedef on public.kanal_izinleri (kanal_id, hedef, coalesce(rol_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.kanal_izinleri enable row level security;
drop policy if exists kanal_izinleri_oku on public.kanal_izinleri;
create policy kanal_izinleri_oku on public.kanal_izinleri for select to authenticated using (uye_mi(kanal_odasi(kanal_id)));

-- Bir üyenin bir kanaldaki etkin izin maskesi
create or replace function public.uye_kanal_izni(p_uye uuid, p_kanal uuid) returns bigint
language plpgsql stable security definer set search_path to 'public' as
$$
declare
  v_rol text; v_m bigint; v_ver bigint; v_yasak bigint;
begin
  select u.rol into v_rol from public.uyeler u where u.id = p_uye;
  if v_rol is null then return 0; end if;
  v_m := coalesce(public.uye_izni(p_uye), 0);
  if v_rol = 'sahip' then return v_m; end if;
  select coalesce(bit_or(ver), 0), coalesce(bit_or(yasak), 0) into v_ver, v_yasak from public.kanal_izinleri where kanal_id = p_kanal and hedef = 'herkes';
  v_m := (v_m & ~v_yasak) | v_ver;
  select coalesce(bit_or(ki.ver), 0), coalesce(bit_or(ki.yasak), 0) into v_ver, v_yasak
    from public.kanal_izinleri ki
    where ki.kanal_id = p_kanal and (
      (ki.hedef = 'moderator' and v_rol = 'moderator')
      or (ki.hedef = 'rol' and ki.rol_id in (select ur.rol_id from public.uye_rolleri ur where ur.uye_id = p_uye)));
  return (v_m & ~v_yasak) | v_ver;
end $$;

-- Benim bu kanaldaki etkin iznim (istemci bunu yazı alanı ve sesli oda için kullanır)
create or replace function public.kanal_izni(p_kanal uuid) returns bigint
language sql stable security definer set search_path to 'public' as
$$
  select public.uye_kanal_izni(u.id, p_kanal)
  from public.uyeler u
  where u.oda_id = public.kanal_odasi(p_kanal) and u.user_id = auth.uid() and not u.silindi
  limit 1;
$$;

alter policy mesajlar_yaz on public.mesajlar
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and (uye_kanal_izni(uye_id, kanal_id) & 1) <> 0 and yavas_mod_uygun(kanal_id, uye_id)
    and ust_mesaj_gecerli(ust_mesaj_id, kanal_id) and yanit_gecerli(yanit_id, kanal_id)
    and (ek_yol is null or ((uye_kanal_izni(uye_id, kanal_id) & 2) <> 0 and ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%')));

-- Ayarlama: yalnızca "kanalları yönet" izni olanlar. ver = yasak = 0 ise satır silinir.
create or replace function public.kanal_izin_ayarla(p_kanal uuid, p_hedef text, p_rol uuid, p_ver bigint, p_yasak bigint) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare
  v_oda uuid := public.kanal_odasi(p_kanal);
begin
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Kanal izinlerini değiştirme yetkin yok'; end if;
  if p_hedef not in ('herkes', 'moderator', 'rol') then raise exception 'Geçersiz hedef'; end if;
  if p_hedef = 'rol' and (p_rol is null or not exists (select 1 from public.roller r where r.id = p_rol and r.oda_id = v_oda)) then raise exception 'Geçersiz rol'; end if;
  if p_hedef <> 'rol' then p_rol := null; end if;
  if p_ver < 0 or p_ver > 15 or p_yasak < 0 or p_yasak > 15 then raise exception 'Geçersiz izin'; end if;
  p_yasak := p_yasak & ~p_ver;  -- aynı bit hem verilip hem kısılamaz: izin kazanır
  delete from public.kanal_izinleri where kanal_id = p_kanal and hedef = p_hedef and rol_id is not distinct from p_rol;
  if p_ver <> 0 or p_yasak <> 0 then
    insert into public.kanal_izinleri (kanal_id, hedef, rol_id, ver, yasak) values (p_kanal, p_hedef, p_rol, p_ver, p_yasak);
  end if;
  insert into public.denetim_kaydi (oda_id, eyleyen, eylem, hedef, ayrinti)
    select v_oda, u.id, 'kanal_izin', (select ad from public.kanallar where id = p_kanal), jsonb_build_object('hedef', p_hedef, 'rol', p_rol, 'ver', p_ver, 'yasak', p_yasak)
    from public.uyeler u where u.oda_id = v_oda and u.user_id = auth.uid() limit 1;
end $$;

revoke all on function public.uye_kanal_izni(uuid, uuid), public.kanal_izni(uuid), public.kanal_izin_ayarla(uuid, text, uuid, bigint, bigint) from public, anon;
grant execute on function public.kanal_izni(uuid), public.kanal_izin_ayarla(uuid, text, uuid, bigint, bigint) to authenticated;
grant execute on function public.uye_kanal_izni(uuid, uuid) to authenticated, service_role;
