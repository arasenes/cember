-- Güvenlik uyarısı: sabit search_path olmayan iki yardımcı işlev
alter function public.izin_maske(text) set search_path = public;
alter function public.kelime_norm(text) set search_path = public;
