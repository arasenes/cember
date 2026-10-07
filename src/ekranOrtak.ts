// Ekran paylaşımının iki motor (LiveKit ve doğrudan) için ortak parçaları.
export type EkranKalite = "720" | "1080";
export type Izlenen = { uyeId: string; akis: MediaStream };
export type EkranSonuc = { ok: boolean; mesaj?: string };

// Dizi/film için akıcılık önemli: 30 kare/sn. Bit hızları tasarrufa göre seçildi (LiveKit ücretsiz planda aylık 50 GB indirme sınırı var).
export const KALITE: Record<EkranKalite, { genislik: number; yukseklik: number; kare: number; bitHizi: number; etiket: string }> = {
  "720": { genislik: 1280, yukseklik: 720, kare: 30, bitHizi: 2_500_000, etiket: "720p (tasarruflu)" },
  "1080": { genislik: 1920, yukseklik: 1080, kare: 30, bitHizi: 4_500_000, etiket: "1080p (daha net)" },
};

/** Android uygulamasındaki (APK) yerel ekran yakalama eklentisi; tarayıcıda ve iOS'ta yoktur. */
export type YerelEkran = {
  baslat(o: { url: string; token: string }): Promise<void>;
  durdur(): Promise<void>;
  surum?(): Promise<{ kod: number; ad: string }>;
  addListener(ad: "durdu", f: () => void): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
};
type CapacitorKopru = {
  Plugins?: Record<string, unknown>;
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (ad: string) => boolean;
  registerPlugin?: (ad: string) => unknown;
};
let kayitliEkran: YerelEkran | null = null;
export function yerelEkran(): YerelEkran | null {
  const c = (globalThis as { Capacitor?: CapacitorKopru }).Capacitor;
  if (!c) return null;
  // Yerel (Kotlin) eklentiler, JS tarafında kayıt edilmedikçe Capacitor.Plugins içinde görünmez; bu yüzden kaydı biz yaparız.
  let p = c.Plugins?.EkranYakala as YerelEkran | undefined;
  if (!p && c.isNativePlatform?.() && (c.isPluginAvailable?.("EkranYakala") ?? true) && typeof c.registerPlugin === "function") {
    kayitliEkran ??= c.registerPlugin("EkranYakala") as YerelEkran;
    p = kayitliEkran;
  }
  return p && typeof p.baslat === "function" ? p : null;
}

/** Tarayıcılar (bilgisayar) ekran paylaşabilir; telefon tarayıcısı paylaşamaz, APK ise yerel eklentiyle paylaşır (ayrıca yerelEkran). */
export function ekranPaylasilabilirTarayici(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}
/** Çember Android uygulaması (APK) içinde mi çalışıyoruz? */
export function uygulamaIci(): boolean {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}
/** iPhone/iPad (Safari ve ana ekran uygulaması): Apple tarayıcıdan ekran paylaşımına izin vermez. */
export function iosMu(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
}
export const IOS_PAYLASIM_MESAJI = "iPhone/iPad ekran paylaşımını desteklemiyor (Apple tarayıcıdan izin vermiyor). Başkasının paylaşımını izleyebilirsin; paylaşmak için bilgisayardan ya da Android'den gir.";
function telefonMu(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
/** Paylaşma düğmesi gösterilsin mi? Telefonda her zaman gösterilir; paylaşamıyorsa basınca nedenini söyler. */
export function ekranPaylasilabilir(motorLivekit = true): boolean {
  return ekranPaylasilabilirTarayici() || (motorLivekit && (yerelEkran() !== null || uygulamaIci() || telefonMu()));
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
