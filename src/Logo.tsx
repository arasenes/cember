// Çember'in tek, birleşik marka işareti: lacivert zemin + kulaklıklı gülen yüz (turuncu).
// public/ikon.svg (favicon/PWA/APK) ile aynı motif ve oranlar (bkz. android-ayar/ikon_uret.py).
export function Logo({ boyut = 44 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="23" fill="#0E1730" />
      <circle cx="50" cy="50" r="26.7" fill="none" stroke="#E8A33D" strokeWidth="8" />
      <circle cx="39.3" cy="45.6" r="3.1" fill="#E8A33D" />
      <circle cx="60.7" cy="45.6" r="3.1" fill="#E8A33D" />
      <path d="M38.4 58.9 Q50 64.2 61.6 58.9" fill="none" stroke="#E8A33D" strokeWidth="4.4" strokeLinecap="round" />
      <rect x="14" y="37.1" width="12.9" height="23.6" rx="6.4" fill="#E8A33D" />
      <rect x="73.1" y="37.1" width="12.9" height="23.6" rx="6.4" fill="#E8A33D" />
      <path d="M80.2 62.4 Q76.7 74.9 66 77.6" fill="none" stroke="#E8A33D" strokeWidth="3.8" strokeLinecap="round" />
      <circle cx="64.7" cy="78.4" r="2.8" fill="#E8A33D" />
    </svg>
  );
}
