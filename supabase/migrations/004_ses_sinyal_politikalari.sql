-- P2P sesli oda sinyalleşmesi: özel Realtime kanalı "ses:<kanal_id>". Yalnızca o odanın üyeleri okuyup yazabilir.
create policy ses_sinyal_oku on realtime.messages for select to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from public.kanallar k
    where ('ses:' || k.id::text) = (select realtime.topic())
      and k.tur = 'sesli'
      and public.uye_mi(k.oda_id)
  )
);
create policy ses_sinyal_yaz on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from public.kanallar k
    where ('ses:' || k.id::text) = (select realtime.topic())
      and k.tur = 'sesli'
      and public.uye_mi(k.oda_id)
  )
);
