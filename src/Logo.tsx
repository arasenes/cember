// Çember'in tek, birleşik marka işareti: lacivert zemin + turuncu halka + krem nokta.
// public/ikon.svg (favicon/PWA/APK) ile aynı motif; oranlar orada da aynı (halka kalınlığı ~r*0.4, nokta ~r*0.25).
export function Logo({ boyut = 44 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 44 44" aria-hidden="true">
      <rect width="44" height="44" rx="11" fill="#0E1730" />
      <g className="logo-don">
        <circle cx="22" cy="22" r="13.5" fill="none" stroke="#E8A33D" strokeWidth="6" />
        <circle cx="22" cy="22" r="3.4" fill="#FAF6EE" />
      </g>
    </svg>
  );
}
