-- Aşama 2: özel mesaj (DM), grup DM, arkadaşlık/engelleme. Tablolar + RLS (yazma işlemleri 021'deki işlevlerle).
-- Karar: DM mesajları ayrı tabloda. `mesajlar` ve yardımcıları (kanal_odasi, uye_mi, kanal_erisim), arama, anket ve
-- `bildir` tetikleyicisi bir odaya bağlı; DM'i oraya sokmak RLS yüzeyini büyütür ve bildirim sızıntısı riski doğurur.

alter table public.uyeler add column if not exists durum_metin text check (durum_metin is null or char_length(durum_metin) <= 60);

create table if not exists public.arkadasliklar (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.uyeler(id) on delete cascade,  -- isteği gönderen / engelleyen
  b uuid not null references public.uyeler(id) on delete cascade,  -- hedef
  durum text not null check (durum in ('bekliyor', 'kabul', 'engelli')),
  olusturma timestamptz not null default now(),
  check (a <> b),
  unique (a, b)
);
-- İstek/arkadaşlık için çift başına tek satır; engeller yöne göre ayrı tutulur
create unique index if not exists arkadasliklar_cift on public.arkadasliklar (least(a, b), greatest(a, b)) where durum <> 'engelli';
create index if not exists arkadasliklar_b on public.arkadasliklar (b);

create table if not exists public.dm_kanallari (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('ikili', 'grup')),
  ad text check (ad is null or char_length(ad) between 1 and 40),
  olusturan uuid references public.uyeler(id) on delete set null,
  ikili_anahtar text unique,
  olusturma timestamptz not null default now(),
  son_mesaj timestamptz not null default now()
);
create table if not exists public.dm_uyeleri (
  dm_id uuid not null references public.dm_kanallari(id) on delete cascade,
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  son_okuma timestamptz not null default now(),
  katilma timestamptz not null default now(),
  primary key (dm_id, uye_id)
);
create index if not exists dm_uyeleri_uye on public.dm_uyeleri (uye_id);
create table if not exists public.dm_mesajlari (
  id uuid primary key default gen_random_uuid(),
  dm_id uuid not null references public.dm_kanallari(id) on delete cascade,
  uye_id uuid not null references public.uyeler(id),
  metin text not null check (char_length(metin) between 1 and 4000),
  olusturma timestamptz not null default now(),
  duzenleme timestamptz,
  silindi boolean not null default false
);
create index if not exists dm_mesajlari_dm_zaman on public.dm_mesajlari (dm_id, olusturma desc);

alter table public.arkadasliklar enable row level security;
alter table public.dm_kanallari enable row level security;
alter table public.dm_uyeleri enable row level security;
alter table public.dm_mesajlari enable row level security;
