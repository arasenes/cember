// Android uygulamasından (APK) Google girişine gidilince oturum bilgisi önce telefonun tarayıcısına döner.
// Tarayıcıdaki sayfa "Uygulamada aç" bağlantısıyla bilgiyi uygulamaya taşır; uygulama da burada bilgiyi
// adres çubuğundan okuyup Supabase'in beklediği biçime (#access_token=...) çevirir.
// Bu dosya supabase istemcisinden ÖNCE yüklenmeli (main.tsx'te ilk içe aktarma).

function parcala(s: string): URLSearchParams {
  return new URLSearchParams(s.startsWith("#") || s.startsWith("?") ? s.slice(1) : s);
}

function tokenliMi(p: URLSearchParams): boolean {
  return !!p.get("access_token") && !!p.get("refresh_token");
}

let hash = "";
try {
  const sorgu = parcala(location.search);
  if (tokenliMi(sorgu)) {
    // Uygulama içindeyiz: ?access_token=... → #access_token=...
    history.replaceState(null, "", location.pathname + "#" + sorgu.toString());
  }
  if (tokenliMi(parcala(location.hash))) hash = location.hash.slice(1);
} catch { /* yoksay */ }

/** Tarayıcı adres çubuğunda yeni giriş bilgisi varsa (uygulamaya taşınmak üzere) hash metni */
export const donusHash = hash;

/** Uygulamayı belirli bir giriş bilgisiyle açan Android bağlantısı */
export function uygulamaBaglantisi(h: string): string {
  return `intent://giris?${h}#Intent;scheme=com.cember.chat;package=com.cember.chat;end`;
}
