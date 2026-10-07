import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { uygulamaIci } from "./ekranOrtak";

/** Supabase'de Google sağlayıcısı açık mı? (açık değilse düğme gösterilmez) */
export async function googleAcikMi(): Promise<boolean> {
  try {
    if (!SUPABASE_URL || uygulamaIci()) return false;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.external?.google === true;
  } catch {
    return false;
  }
}

export async function googleIleGir(): Promise<string> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  return error ? "Google ile giriş başlatılamadı." : "";
}

export async function googleBagla(): Promise<string> {
  const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } });
  return error ? "Google hesabı bağlanamadı." : "";
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
