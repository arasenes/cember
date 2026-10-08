import { supabase } from "./supabase";
import { uygulamaIci } from "./ekranOrtak";

/** Tarayıcı bildirimleri için herkese açık VAPID anahtarı (gizli eşi yalnızca sunucuda) */
const VAPID_ACIK = "BGCAo3UAaCMX1Ixm5eB51OzKhxwCH0-WYE3sXhfAjtp5xxxFRzy-UgEQ2jJ1B0VnCiQed8PvwbWu_vD37HhGwg4";
const ANAHTAR = "cember.push";

type Kayit = { acik: boolean; sadeceEtiket: boolean; uc?: string };
export type PushSonuc = { ok: boolean; mesaj?: string };

function oku(): Kayit {
  try { return { acik: false, sadeceEtiket: false, ...(JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Partial<Kayit>) }; } catch { return { acik: false, sadeceEtiket: false }; }
}
function yaz(k: Kayit) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(k)); } catch { /* yoksay */ }
}

type YerelPush = {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  unregister?(): Promise<void>;
  createChannel?(o: { id: string; name: string; importance: number; visibility?: number }): Promise<void>;
  addListener(ad: string, f: (v: { value?: string; error?: string }) => void): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
};
function yerelPush(): YerelPush | null {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (ad: string) => unknown } }).Capacitor;
  if (!c?.isNativePlatform?.() || typeof c.registerPlugin !== "function") return null;
  return c.registerPlugin("PushNotifications") as YerelPush;
}

export function pushDestekli(): boolean {
  if (uygulamaIci()) return yerelPush() !== null;
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window && typeof Notification !== "undefined";
}
/** Bildirim desteklenmiyorsa nedenini kısaca anlatır (ayarlarda tanı satırı). */
export function pushTani(): string {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; registerPlugin?: unknown } }).Capacitor;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return `Capacitor: ${c ? "var" : "yok"}, platform: ${c?.getPlatform?.() ?? "-"}, yerel: ${String(c?.isNativePlatform?.() ?? "-")}, registerPlugin: ${typeof c?.registerPlugin}, SW: ${typeof navigator !== "undefined" && "serviceWorker" in navigator}, PushManager: ${typeof window !== "undefined" && "PushManager" in window}, WebView: ${/; wv\)/.test(ua)}`;
}
export function pushAcikMi(): boolean { return oku().acik; }
export function pushSadeceEtiket(): boolean { return oku().sadeceEtiket; }

function anahtarCoz(b64: string): Uint8Array<ArrayBuffer> {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(s);
  const o = new Uint8Array(new ArrayBuffer(ham.length));
  for (let i = 0; i < ham.length; i++) o[i] = ham.charCodeAt(i);
  return o;
}
const b64u = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

async function sunucuyaKaydet(tur: "web" | "fcm", uc: string, p256dh: string | null, auth: string | null, sadeceEtiket: boolean): Promise<boolean> {
  const { error } = await supabase.rpc("push_kaydet", { p_tur: tur, p_uc: uc, p_p256dh: p256dh, p_auth: auth, p_sadece_etiket: sadeceEtiket });
  return !error;
}

async function webKaydol(sadeceEtiket: boolean): Promise<PushSonuc> {
  if (Notification.permission === "denied") return { ok: false, mesaj: "Bildirim izni engellenmiş. Tarayıcı ayarlarından siteye bildirim iznini aç." };
  const izin = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (izin !== "granted") return { ok: false, mesaj: "Bildirim izni verilmedi." };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let abone = await reg.pushManager.getSubscription();
  if (!abone) abone = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarCoz(VAPID_ACIK) });
  const j = abone.toJSON();
  const p256dh = j.keys?.p256dh ?? b64u(abone.getKey("p256dh"));
  const auth = j.keys?.auth ?? b64u(abone.getKey("auth"));
  if (!(await sunucuyaKaydet("web", abone.endpoint, p256dh, auth, sadeceEtiket))) return { ok: false, mesaj: "Bildirim kaydedilemedi, tekrar dene." };
  yaz({ acik: true, sadeceEtiket, uc: abone.endpoint });
  return { ok: true };
}

async function yerelKaydol(sadeceEtiket: boolean): Promise<PushSonuc> {
  const p = yerelPush();
  if (!p) return { ok: false, mesaj: "Bu cihaz bildirimi desteklemiyor." };
  try { await p.createChannel?.({ id: "mesajlar", name: "Mesajlar", importance: 4, visibility: 1 }); } catch { /* yoksay */ }
  const izin = await p.requestPermissions();
  if (izin.receive !== "granted") return { ok: false, mesaj: "Bildirim izni verilmedi. Telefon ayarlarından Çember için bildirimi aç." };
  let kaldir: Array<{ remove: () => Promise<void> }> = [];
  try {
    const jeton = await new Promise<string>((coz, red) => {
      const zaman = setTimeout(() => red(new Error("zaman")), 15000);
      void Promise.resolve(p.addListener("registration", (v) => { clearTimeout(zaman); coz(v.value ?? ""); })).then((l) => kaldir.push(l));
      void Promise.resolve(p.addListener("registrationError", (v) => { clearTimeout(zaman); red(new Error(v.error ?? "hata")); })).then((l) => kaldir.push(l));
      void p.register();
    });
    if (!jeton) return { ok: false, mesaj: "Bildirim anahtarı alınamadı." };
    if (!(await sunucuyaKaydet("fcm", jeton, null, null, sadeceEtiket))) return { ok: false, mesaj: "Bildirim kaydedilemedi, tekrar dene." };
    yaz({ acik: true, sadeceEtiket, uc: jeton });
    return { ok: true };
  } catch {
    return { ok: false, mesaj: "Bildirim açılamadı. Bu uygulama sürümü bildirimi desteklemiyor olabilir; en son APK'yı kur." };
  } finally {
    for (const l of kaldir) void l.remove();
    kaldir = [];
  }
}

/** Bildirimleri aç (izin ister, bu cihazı sunucuya kaydeder). */
export async function pushAc(sadeceEtiket = false): Promise<PushSonuc> {
  if (!pushDestekli()) return { ok: false, mesaj: "Bu tarayıcı bildirimi desteklemiyor. iPhone'da önce siteyi ana ekrana ekle." };
  try {
    return uygulamaIci() ? await yerelKaydol(sadeceEtiket) : await webKaydol(sadeceEtiket);
  } catch {
    return { ok: false, mesaj: "Bildirim açılamadı." };
  }
}

/** Bildirimleri kapat ve bu cihazın kaydını sil. */
export async function pushKapat(): Promise<void> {
  const k = oku();
  try {
    if (!uygulamaIci() && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const abone = await reg?.pushManager.getSubscription();
      if (abone) { await supabase.rpc("push_sil", { p_uc: abone.endpoint }); await abone.unsubscribe(); }
    } else if (k.uc) {
      await supabase.rpc("push_sil", { p_uc: k.uc });
    }
  } catch { /* yoksay */ }
  yaz({ acik: false, sadeceEtiket: k.sadeceEtiket });
}

/** "Sadece etiketlenince" tercihini değiştir. */
export async function pushTercih(sadeceEtiket: boolean): Promise<PushSonuc> {
  if (!oku().acik) { yaz({ ...oku(), sadeceEtiket }); return { ok: true }; }
  return pushAc(sadeceEtiket);
}

/** Oturum açılınca: bildirim daha önce açıldıysa bu cihazı geçerli üyeye yeniden bağlar (sessizce). */
export async function pushYenile(): Promise<void> {
  const k = oku();
  if (!k.acik || !pushDestekli()) return;
  if (!uygulamaIci() && Notification.permission !== "granted") return;
  await pushAc(k.sadeceEtiket);
}
