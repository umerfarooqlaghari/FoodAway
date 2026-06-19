export default function SupermarketHeroVisual({ className = '' }) {
  return (
    <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect width="480" height="360" rx="24" fill="#FFF7ED" />
      <rect x="40" y="48" width="400" height="264" rx="16" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="2" />
      <rect x="40" y="48" width="400" height="56" rx="16" fill="#FF5A00" />
      <rect x="40" y="88" width="400" height="16" fill="#FF5A00" />
      <text x="240" y="84" textAnchor="middle" fill="#FFFFFF" fontFamily="Outfit, system-ui, sans-serif" fontSize="18" fontWeight="700" letterSpacing="2">SUPERMARKET</text>
      {[72, 196, 320].map((x) => (
        <g key={x}>
          <rect x={x} y="128" width="88" height="72" rx="8" fill="#FFF7ED" stroke="#FF5A00" strokeWidth="1.5" />
          <rect x={x + 8} y="136" width="72" height="12" rx="3" fill="#FF5A00" opacity="0.85" />
          <rect x={x + 8} y="154" width="56" height="8" rx="2" fill="#FDBA74" />
          <rect x={x + 8} y="168" width="64" height="8" rx="2" fill="#FDBA74" />
          <rect x={x + 8} y="182" width="48" height="8" rx="2" fill="#FDBA74" />
        </g>
      ))}
      <rect x="72" y="224" width="336" height="56" rx="10" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1.5" />
      {[88, 148, 208, 268, 328].map((x, i) => (
        <rect key={x} x={x} y="240" width="48" height="24" rx="4" fill="#FF5A00" opacity={0.2 + i * 0.15} />
      ))}
      <text x="240" y="258" textAnchor="middle" fill="#9A3412" fontFamily="Outfit, system-ui, sans-serif" fontSize="11" fontWeight="600" letterSpacing="1">FMCG · HOUSEHOLD · GROCERY</text>
      <circle cx="400" cy="280" r="28" fill="#FF5A00" />
      <path d="M382 280 L396 280 L396 268 L408 280 L396 292 L396 280" fill="#FFFFFF" />
      <rect x="56" y="296" width="120" height="28" rx="14" fill="#FF5A00" />
      <text x="116" y="315" textAnchor="middle" fill="#FFFFFF" fontFamily="Outfit, system-ui, sans-serif" fontSize="11" fontWeight="700">PREMIUM DISCOUNTS</text>
    </svg>
  );
}
