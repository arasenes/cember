-- Başlangıç odası ve kanalları. Davet kodu rastgele üretilir; kodu görmek için Supabase SQL editöründe:
--   select davet_kodu from odalar;
-- Çalıştırmadan önce odalar tablosunun boş olduğundan emin ol.
-- Odaya ilk giren kişi "sahip" olur; bu yüzden önce sen gir.
with o as (
  insert into public.odalar (ad, davet_kodu)
  values ('Çember', 'CMB-' || upper(substr(translate(encode(gen_random_bytes(8),'hex'),'01ilo','23456'),1,4)) || '-' || upper(substr(translate(encode(gen_random_bytes(8),'hex'),'01ilo','23456'),1,4)))
  returning id
)
insert into public.kanallar (oda_id, ad, tur, sira)
select o.id, v.ad, v.tur, v.sira from o, (values
  ('genel','yazili',1),('oyun','yazili',2),('foto-ve-dosya','yazili',3),
  ('Sohbet odası','sesli',4),('Oyun odası','sesli',5)) as v(ad,tur,sira);
