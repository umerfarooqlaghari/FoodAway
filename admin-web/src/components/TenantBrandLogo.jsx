import { useId, useState } from 'react';

function tenantInitials(name) {
  return String(name || 'G')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function colorFromName(name) {
  let hash = 0;
  const str = String(name || 'brand');
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    start: `hsl(${hue}, 85%, 52%)`,
    end: `hsl(${(hue + 40) % 360}, 70%, 28%)`,
  };
}

/**
 * Brand mark — always SVG. Raster logos are embedded via SVG <image>.
 * Missing/broken logos get a gradient badge with initials.
 */
export default function TenantBrandLogo({
  name,
  logo,
  size = 88,
  className = '',
  variant = 'card',
}) {
  const uid = useId().replace(/:/g, '');
  const [failed, setFailed] = useState(false);
  const showRaster = logo && !failed;
  const initials = tenantInitials(name);
  const colors = colorFromName(name);
  const radius = variant === 'header' ? 10 : 18;

  return (
    <svg
      viewBox="0 0 88 88"
      width={size}
      height={size}
      className={`tenant-brand-logo tenant-brand-logo--${variant} ${className}`.trim()}
      role="img"
      aria-label={name || 'Brand'}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
        <linearGradient id={`accent-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF5A00" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <rect x="4" y="4" width="80" height="80" rx={radius} />
        </clipPath>
      </defs>

      {/* Frame */}
      <rect x="2" y="2" width="84" height="84" rx={radius + 2} fill="#fff" stroke="#f0f0f0" strokeWidth="2" />

      {showRaster ? (
        <>
          <rect x="4" y="4" width="80" height="80" rx={radius} fill="#fff8f5" />
          <image
            href={logo}
            x="8"
            y="8"
            width="72"
            height="72"
            clipPath={`url(#clip-${uid})`}
            preserveAspectRatio="xMidYMid meet"
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="80" height="80" rx={radius} fill={`url(#accent-${uid})`} />
          {/* Storefront icon */}
          <path
            d="M28 38 L44 28 L60 38 V58 H28 Z"
            fill="rgba(255,255,255,0.2)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="38" y="48" width="12" height="10" rx="1" fill="rgba(255,255,255,0.35)" />
          <text
            x="44"
            y="72"
            textAnchor="middle"
            fill="#fff"
            fontSize="18"
            fontWeight="800"
            fontFamily="'Outfit', system-ui, sans-serif"
          >
            {initials}
          </text>
        </>
      )}
    </svg>
  );
}
