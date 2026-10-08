-- Uygulama sesleri ayarı (açık/kapalı, seviye, takım). Satır sahibine özel RLS 035'ten gelir.
alter table public.kullanici_ayarlari add column if not exists ses_ayar jsonb;
