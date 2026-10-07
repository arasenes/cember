-- Aşama 3: yöneticinin sesli odada birini sunucudan susturması. yonetim_komutlari.tur'a iki yeni değer.
-- Not: kısıtın adı canlıda `yonetim_komutlari_tur_check` olmalı; farklıysa önce pg_constraint'ten bak.
alter table public.yonetim_komutlari drop constraint if exists yonetim_komutlari_tur_check;
alter table public.yonetim_komutlari add constraint yonetim_komutlari_tur_check check (tur in ('ses-at', 'tasi', 'sustur', 'sustur-kaldir'));
