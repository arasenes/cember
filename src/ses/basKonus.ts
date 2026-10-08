import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";

// Bas-konuş (push-to-talk): açıkken mikrofon kapalıdır, atanan tuşa (varsayılan V) basılı tutarken açılır.
// Tuş dinleyicisi yalnızca sesli odadayken ve bir yazı alanında değilken çalışır. Telefonda ekrandaki "basılı tut" düğmesi kullanılır.
export type BasKonusAyar = { acik: boolean; tus: string };
export const VARSAYILAN_AYAR: BasKonusAyar = { acik: false, tus: "KeyV" };
const ANAHTAR = "cember-bas-konus";

export function ayarOku(): BasKonusAyar {
  try {
    const j = JSON.parse(localStorage.getItem(ANAHTAR) ?? "null") as Partial<BasKonusAyar> | null;
    return { acik: j?.acik === true, tus: typeof j?.tus === "string" && j.tus ? j.tus : VARSAYILAN_AYAR.tus };
  } catch { return VARSAYILAN_AYAR; }
}
export function ayarYaz(a: BasKonusAyar) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(a)); } catch { /* yoksay */ }
}

/** Tuş koduna okunur ad verir: "KeyV" → "V", "Space" → "Boşluk". */
export function tusAdi(kod: string): string {
  if (/^Key[A-Z]$/.test(kod)) return kod.slice(3);
  if (/^Digit\d$/.test(kod)) return kod.slice(5);
  const ozel: Record<string, string> = { Space: t("Boşluk"), Backquote: "`", ControlLeft: t("Sol Ctrl"), ControlRight: t("Sağ Ctrl"), ShiftLeft: t("Sol Shift"), ShiftRight: t("Sağ Shift"), AltLeft: t("Sol Alt"), AltRight: t("Sağ Alt"), CapsLock: "Caps Lock", Tab: "Tab" };
  return ozel[kod] ?? kod;
}
/** Atanamayacak tuşlar: sohbet ve gezinme için gerekli olanlar. */
export function tusAtanabilir(kod: string): boolean {
  return !/^(Escape|Enter|NumpadEnter|Backspace|Delete|Tab|Meta.*|OS.*|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|F5|F11|F12)$/.test(kod);
}

/** Olay yazı yazılan bir alandan mı geliyor? (Bu durumda bas-konuş tuşu harf olarak yazılır.) */
export function yazmaAlaniMi(hedef: EventTarget | null): boolean {
  const el = hedef as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const t = el.tagName.toLowerCase();
  if (t === "textarea" || t === "select") return true;
  if (t === "input") return !["checkbox", "radio", "button", "range", "submit", "file"].includes((el as HTMLInputElement).type);
  return el.isContentEditable === true;
}

type SesBaglami = { kanalId: string | null; mikAyarla: (acik: boolean) => Promise<void> | void };

export function useBasKonus(ayar: BasKonusAyar, ses: SesBaglami) {
  const [basili, setBasili] = useState(false);
  const sesRef = useRef(ses);
  sesRef.current = ses;
  const basiliRef = useRef(false);
  const odada = !!ses.kanalId;

  const ayarla = useCallback((b: boolean) => {
    if (basiliRef.current === b) return;
    basiliRef.current = b;
    setBasili(b);
    void sesRef.current.mikAyarla(b);
  }, []);

  // Mod açılınca mikrofon kapanır; kapanınca (odadaysak) yeniden açılır
  useEffect(() => {
    if (!odada) { basiliRef.current = false; setBasili(false); return; }
    if (ayar.acik) { basiliRef.current = false; setBasili(false); void sesRef.current.mikAyarla(false); }
    return () => { if (ayar.acik) { basiliRef.current = false; void sesRef.current.mikAyarla(true); } };
  }, [ayar.acik, odada]);

  useEffect(() => {
    if (!ayar.acik || !odada) return;
    const asagi = (e: KeyboardEvent) => {
      if (e.code !== ayar.tus || e.repeat || yazmaAlaniMi(e.target)) return;
      e.preventDefault();
      ayarla(true);
    };
    const yukari = (e: KeyboardEvent) => { if (e.code === ayar.tus) ayarla(false); };
    const birak = () => ayarla(false);
    window.addEventListener("keydown", asagi);
    window.addEventListener("keyup", yukari);
    window.addEventListener("blur", birak);
    return () => {
      window.removeEventListener("keydown", asagi);
      window.removeEventListener("keyup", yukari);
      window.removeEventListener("blur", birak);
    };
  }, [ayar.acik, ayar.tus, odada, ayarla]);

  return { basili, bas: () => ayarla(true), birak: () => ayarla(false) };
}
