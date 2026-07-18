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

function FallbackBadge({ name, variant, uid, initials }) {
  const radius = variant === 'header' ? 10 : 18;
  return (
    <svg
      viewBox="0 0 88 88"
      width="100%"
      height="100%"
      role="img"
      aria-label={name || 'Brand'}
    >
      <defs>
        <linearGradient id={`accent-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF5C00" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="84" height="84" rx={radius + 2} fill="#fff" stroke="#f0f0f0" strokeWidth="2" />
      <rect x="4" y="4" width="80" height="80" rx={radius} fill={`url(#accent-${uid})`} />
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
    </svg>
  );
}

/**
 * Brand mark — raster logos use <img> (reliable on mobile); missing/broken logos get initials badge.
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
  const radius = variant === 'header' ? 10 : 18;

  return (
    <div
      className={`tenant-brand-logo tenant-brand-logo--${variant} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {showRaster ? (
        <img
          src={logo}
          alt={name || 'Brand'}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            borderRadius: radius,
            border: '2px solid #f0f0f0',
            background: '#fff8f5',
            display: 'block',
          }}
        />
      ) : (
        <FallbackBadge
          name={name}
          variant={variant}
          uid={uid}
          initials={initials}
        />
      )}
    </div>
  );
}
