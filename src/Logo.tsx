// Çember'in resmi marka maskotu: "Çombi"
// Kulaklıklı kozmik robot kafa, canlı LED gözler ve "Ç" çengeli oluşturan mikrofon sapı.
export function Logo({ boyut = 44, className }: { boyut?: number; className?: string }) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="cemberBotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="cemberEarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/* Modern Squircle Zemin */}
      <rect width="100" height="100" rx="24" fill="#0D1322" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* Kulaklık Üst Bandı (Çember Kemeri) */}
      <path d="M 24 46 C 24 24, 76 24, 76 46" stroke="url(#cemberBotGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />

      {/* Kulaklık Yastıkları */}
      <rect x="17" y="41" width="9.5" height="21" rx="4.5" fill="url(#cemberEarGrad)" />
      <rect x="73.5" y="41" width="9.5" height="21" rx="4.5" fill="url(#cemberEarGrad)" />

      {/* Robotun Yuvarlak Gövdesi / Yüzü */}
      <rect x="25" y="32" width="50" height="42" rx="18" fill="#182033" stroke="url(#cemberBotGrad)" strokeWidth="3.8" />

      {/* Gözler (Dostane LED Işıklar) */}
      <ellipse cx="40" cy="50" rx="4.5" ry="6.5" fill="#38BDF8" />
      <ellipse cx="60" cy="50" rx="4.5" ry="6.5" fill="#38BDF8" />

      {/* Minik Mikrofon Sapı (Ç Harfinin Çengeli Olur) */}
      <path d="M 73 56 C 73 68, 62 74, 52 74" stroke="url(#cemberBotGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="50" cy="74" r="3" fill="#38BDF8" />

      {/* Çengeli Tamamlayan Uydu Noktası */}
      <circle cx="50" cy="85" r="3.8" fill="url(#cemberBotGrad)" />
    </svg>
  );
}
