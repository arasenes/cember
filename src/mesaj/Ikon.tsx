// Çizgi (stroke) ikonları: emoji yerine. Metinsiz düğmelerde düğmeye aria-label verilir; ikon kendisi gizlidir.
const yollar: Record<string, string> = {
  yanit: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v3",
  ilet: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0-6 6v3",
  ara: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.3-4.3",
  anket: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  gif: "M4 6h16v12H4zM8 10v4M8 10h2M12 10v4M15 10v4M15 10h2M15 12h1.5",
  kapat: "M6 6l12 12M18 6 6 18",
  artir: "M12 5v14M5 12h14",
  tamam: "m5 12 5 5L20 7",
};

export type IkonAd = keyof typeof yollar;

export default function Ikon({ ad, boyut = 18 }: { ad: IkonAd; boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={yollar[ad]} />
    </svg>
  );
}
