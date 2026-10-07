-- Yeni sunucu kurma kapatıldı (yalnızca davetle katılım). API'den de çağrılamasın.
revoke execute on function public.sunucu_olustur(text) from authenticated, anon, public;
