// Gürültü engelleme tercihi (tarayıcının yerleşik gürültü bastırma + otomatik ses düzeyi). Varsayılan: açık.
const ANAHTAR = "cember-gurultu";

export function gurultuTercihi(): boolean {
  try { return localStorage.getItem(ANAHTAR) !== "kapali"; } catch { return true; }
}
export function gurultuTercihiKaydet(acik: boolean) {
  try { localStorage.setItem(ANAHTAR, acik ? "acik" : "kapali"); } catch { /* yoksay */ }
}
/** Çalışan mikrofon kanalına anında uygular (yeniden bağlanmaya gerek kalmaz). */
export async function gurultuUygula(iz: MediaStreamTrack | undefined | null, acik: boolean) {
  if (!iz) return;
  try { await iz.applyConstraints({ noiseSuppression: acik, autoGainControl: acik, echoCancellation: true }); } catch { /* tarayıcı desteklemiyor */ }
}
