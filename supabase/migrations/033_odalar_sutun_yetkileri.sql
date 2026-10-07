-- odalar tablosunda sütun bazlı okuma yetkisi var (001: id, ad, olusturan, olusturma). Sonradan eklenen sütunlar da okunabilmeli;
-- aksi halde "select ... from odalar" permission denied verir ve uygulama açılmaz. (Gizli kalan: davet_kodu)
grant select (ikon_metin, ikon_renk, silindi, herkes_izin, moderator_izin, yasakli_kelimeler, hosgeldin_mesaji, hosgeldin_kanal) on public.odalar to authenticated;
