// Ekran paylaşımının iki motor (LiveKit ve doğrudan) için ortak parçaları.
export type EkranKalite = "720" | "1080";
export type Izlenen = { uyeId: string; akis: MediaStream };
export type EkranSonuc = { ok: boolean; mesaj?: string };

// Dizi/film için akıcılık önemli: 30 kare/sn. Bit hızları tasarrufa göre seçildi (LiveKit ücretsiz planda aylık 50 GB indirme sınırı var).
export const KALITE: Record<EkranKalite, { genislik: number; yukseklik: number; kare: number; bitHizi: number; etiket: string }> = {
  "720": { genislik: 1280, yukseklik: 720, kare: 30, bitHizi: 1_800_000, etiket: "720p (tasarruflu)" },
  "1080": { genislik: 1920, yukseklik: 1080, kare: 30, bitHizi: 3_500_000, etiket: "1080p (daha net)" },
};

/** Telefonlar ekran paylaşamaz (tarayıcı desteklemez); yalnızca izleyebilir. */
export function ekranPaylasilabilir(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/** Kullanıcı seçim penceresini kapatırsa (iptal) hata göstermeyiz. */
export function ekranHatasi(e: unknown): EkranSonuc {
  const ad = (e as { name?: string })?.name ?? "";
  if (ad === "NotAllowedError" || ad === "AbortError") return { ok: false };
  if (ad === "NotFoundError") return { ok: false, mesaj: "Paylaşılacak bir ekran ya da pencere bulunamadı." };
  if (ad === "NotReadableError") return { ok: false, mesaj: "Ekran yakalanamadı. Başka bir uygulama engelliyor olabilir." };
  return { ok: false, mesaj: "Ekran paylaşılamadı. Tarayıcını güncelleyip tekrar dene." };
}

export function ekranIstegi(kalite: EkranKalite): DisplayMediaStreamOptions {
  const k = KALITE[kalite];
  return {
    video: { width: { ideal: k.genislik }, height: { ideal: k.yukseklik }, frameRate: { ideal: k.kare, max: k.kare } },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints,
    // Chrome'a özel ipuçları: bu sekmeyi paylaşmayı önerme, sekme sesi seçeneğini göster
    selfBrowserSurface: "exclude",
    systemAudio: "include",
    surfaceSwitching: "include",
  } as DisplayMediaStreamOptions;
}
