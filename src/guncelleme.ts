import { uygulamaIci, yerelEkran } from "./ekranOrtak";

export const APK_ADRESI = "https://github.com/arasenes/cember/releases/download/apk-son/cember.apk";
const SURUM_BILGISI = "https://api.github.com/repos/arasenes/cember/releases/tags/apk-son";

/** Sürüm adından ("Çember Android (test sürümü 7)") numarayı çıkarır. */
export function surumNo(ad: string | null | undefined): number | null {
  const m = /(\d+)\)?\s*$/.exec((ad ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** Yayınlanmış son APK'nın sürüm numarası; okunamazsa null. */
export async function sonSurum(): Promise<number | null> {
  try {
    const r = await fetch(SURUM_BILGISI, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { name?: string };
    return surumNo(j.name);
  } catch {
    return null;
  }
}

/** Telefona kurulu APK'nın sürüm kodu. Eski APK'larda bu özellik yoktur: 0 sayılır (yani "güncelle" denir). */
export async function kuruluSurum(): Promise<number> {
  try {
    const k = await yerelEkran()?.surum?.();
    return typeof k?.kod === "number" ? k.kod : 0;
  } catch {
    return 0;
  }
}

/** Yeni sürüm varsa numarasını, yoksa (ya da uygulama içinde değilsek) null döner. */
export async function yeniSurumVarMi(): Promise<number | null> {
  if (!uygulamaIci()) return null;
  const [son, kurulu] = await Promise.all([sonSurum(), kuruluSurum()]);
  return son !== null && son > kurulu ? son : null;
}
