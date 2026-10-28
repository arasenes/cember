// Çember'in resmi hareketli marka maskotu: "Çombi"
// Canlı yüzen gövde, kırpan LED gözler, parlayan yayın mikrofonu ve nabız gibi atan yörünge uydusu.
export function Logo({
  boyut = 44,
  className,
  hareketli = true,
}: {
  boyut?: number;
  className?: string;
  hareketli?: boolean;
}) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible" }}
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

      {hareketli && (
        <style>{`
          @keyframes combiFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-3.5px); }
          }
          @keyframes combiBlink {
            0%, 92%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.12); }
          }
          @keyframes combiMicPulse {
            0%, 100% { filter: drop-shadow(0 0 2px #38BDF8); opacity: 0.85; }
            50% { filter: drop-shadow(0 0 7px #38BDF8); opacity: 1; }
          }
          @keyframes combiSatellitePulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.5)); }
            50% { transform: scale(1.18); filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.95)); }
          }
          @keyframes combiAura {
            0%, 100% { stroke-opacity: 0.12; }
            50% { stroke-opacity: 0.35; }
          }
          .combi-float {
            animation: combiFloat 3s ease-in-out infinite;
            transform-origin: 50% 50%;
          }
          .combi-eye-l {
            animation: combiBlink 4s ease-in-out infinite;
            transform-origin: 40px 50px;
          }
          .combi-eye-r {
            animation: combiBlink 4s ease-in-out infinite;
            transform-origin: 60px 50px;
          }
          .combi-mic {
            animation: combiMicPulse 1.8s ease-in-out infinite;
          }
          .combi-satellite {
            animation: combiSatellitePulse 2.4s ease-in-out infinite;
            transform-origin: 50px 85px;
          }
          .combi-aura {
            animation: combiAura 3s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .combi-float, .combi-eye-l, .combi-eye-r, .combi-mic, .combi-satellite, .combi-aura {
              animation: none !important;
            }
          }
        `}</style>
      )}

      {/* Modern Squircle Zemin */}
      <rect width="100" height="100" rx="24" fill="#0D1322" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* Dinamik Arka Işık / Aura Çemberi */}
      <circle className="combi-aura" cx="50" cy="50" r="38" stroke="url(#cemberBotGrad)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

      {/* Yüzen Maskot Gövdesi Grubu */}
      <g className={hareketli ? "combi-float" : ""}>
        {/* Kulaklık Üst Bandı (Çember Kemeri) */}
        <path d="M 24 46 C 24 24, 76 24, 76 46" stroke="url(#cemberBotGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />

        {/* Kulaklık Yastıkları */}
        <rect x="17" y="41" width="9.5" height="21" rx="4.5" fill="url(#cemberEarGrad)" />
        <rect x="73.5" y="41" width="9.5" height="21" rx="4.5" fill="url(#cemberEarGrad)" />

        {/* Robotun Yuvarlak Gövdesi / Yüzü */}
        <rect x="25" y="32" width="50" height="42" rx="18" fill="#182033" stroke="url(#cemberBotGrad)" strokeWidth="3.8" />

        {/* Canlı Kırpan LED Gözler */}
        <ellipse className={hareketli ? "combi-eye-l" : ""} cx="40" cy="50" rx="4.5" ry="6.5" fill="#38BDF8" />
        <ellipse className={hareketli ? "combi-eye-r" : ""} cx="60" cy="50" rx="4.5" ry="6.5" fill="#38BDF8" />

        {/* Mikrofon Sapı (Ç Harfinin Çengeli) */}
        <path d="M 73 56 C 73 68, 62 74, 52 74" stroke="url(#cemberBotGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Canlı Yayında Parlayan Mikrofon Ucu */}
        <circle className={hareketli ? "combi-mic" : ""} cx="50" cy="74" r="3.2" fill="#38BDF8" />
      </g>

      {/* Çengeli Tamamlayan Nabız Gibi Parlayan Uydu Noktası */}
      <circle className={hareketli ? "combi-satellite" : ""} cx="50" cy="85" r="3.8" fill="url(#cemberBotGrad)" />
    </svg>
  );
}
