import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { uygulamaIci } from "./ekranOrtak";

/** Supabase'de Google sağlayıcısı açık mı? (açık değilse düğme gösterilmez) */
export async function googleAcikMi(): Promise<boolean> {
  try {
    if (!SUPABASE_URL) return false;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.external?.google === true;
  } catch {
    return false;
  }
}

// Android uygulamasında Google, gömülü pencerede açılmaz: giriş sistem tarayıcısında yapılır, sonra bu adresle uygulamaya dönülür
const UYGULAMA_DONUS = "com.cember.chat://giris";

async function tarayicidaAc(url?: string): Promise<boolean> {
  if (!url) return false;
  window.location.assign(url); // Capacitor, kendi sitesi olmayan adresleri sistem tarayıcısında açar
  return true;
}

export async function googleIleGir(): Promise<string> {
  const app = uygulamaIci();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: app ? UYGULAMA_DONUS : window.location.origin, skipBrowserRedirect: app } });
  if (error) return "Google ile giriş başlatılamadı.";
  if (app && !(await tarayicidaAc(data?.url))) return "Google ile giriş başlatılamadı.";
  return "";
}

export async function googleBagla(): Promise<string> {
  const app = uygulamaIci();
  const { data, error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: app ? UYGULAMA_DONUS : window.location.origin, skipBrowserRedirect: app } });
  if (error) return "Google hesabı bağlanamadı.";
  if (app && !(await tarayicidaAc(data?.url))) return "Google hesabı bağlanamadı.";
  return "";
}

export async function googleBagliMi(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUserIdentities();
    return (data?.identities ?? []).some((i) => i.provider === "google");
  } catch {
    return false;
  }
}

/** Oturumdaki kullanıcı Google ile mi giriş yapmış? */
export function googleKullanicisi(user: { identities?: { provider: string }[] | null } | null | undefined): boolean {
  return (user?.identities ?? []).some((i) => i.provider === "google");
}
