export default function HeroPagePeelTeaser({ onClick }) {
  return (
    <button
      type="button"
      className="hero-page-peel"
      onClick={onClick}
      aria-label="Discover what's coming next"
    >
      {/* <svg viewBox="0 0 200 210" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="hero-page-peel-svg">
        <path d="M200 0H108L200 92V0Z" fill="#FFFFFF" />
        <path d="M200 94C168 78 142 58 122 42" stroke="rgba(0,0,0,0.12)" strokeWidth="8" strokeLinecap="round" />
        <g className="peel-flap-group">
          <path d="M200 0V132L128 68C168 36 200 18 200 0Z" fill="#CC4A00" />
          <path d="M200 0V118L120 58L200 0Z" fill="#FF5C00" />
          <path d="M200 118L120 58" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
        </g>
        <g className="peel-person" transform="translate(120, 58)">
          <path d="M1 0L8-14" stroke="#E8B896" strokeWidth="5" strokeLinecap="round" />
          <path d="M-3 3L-12 12" stroke="#E8B896" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="6" cy="8" r="7.5" fill="#E8B896" />
          <path d="M0 3C3-1 9-1 12 3" fill="#374151" />
          <path d="M-6 15H18L15 34H-3L-6 15Z" fill="#FF5C00" />
          <path d="M6 15L6 20L11 15" stroke="#FFFFFF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M0 34L-3 58" stroke="#1F2937" strokeWidth="7" strokeLinecap="round" />
          <path d="M9 34L13 58" stroke="#1F2937" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="-3" cy="61" rx="6.5" ry="3.5" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.8" />
          <ellipse cx="13" cy="61" rx="6.5" ry="3.5" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.8" />
        </g>
      </svg> */}
      <span className="hero-page-peel-label">What&apos;s next?</span>
      <span className="hero-page-peel-hint">Tap to turn the page</span>
    </button>
  );
}
