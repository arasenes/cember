-- 006_profil.sql, profil güncelleme için yalnızca (takma_ad, renk, avatar_yol, hakkinda) sütunlarına
-- UPDATE izni vermişti. 020_dm_arkadaslik_tablolar.sql'de eklenen durum_metin sütunu bu izne hiç
-- dahil edilmemiş; sonuç: "durum metni"ni değiştiren her profil kaydı "permission denied for table uyeler"
-- hatasıyla reddediliyordu (RLS değil, sütun bazlı GRANT eksikliği).
grant update (durum_metin) on public.uyeler to authenticated;
