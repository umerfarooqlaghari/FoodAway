/**
 * Inline SVG brand mark — always visible (unlike PNG on matching backgrounds).
 * @param {boolean} onDarkBg - white ring so the mark reads on orange/dark backgrounds
 */
export default function GrabengoLogoMark({
  size = 24,
  textClassName = 'grabengo-logo-text',
  className = '',
  showText = true,
  onDarkBg = false,
}) {
  return (
    <span className={`grabengo-logo-mark ${className}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden={showText ? undefined : true}
        role={showText ? undefined : 'img'}
      >
        {onDarkBg && <circle cx="13" cy="13" r="13" fill="#FFFFFF" />}
        <circle
          cx="13"
          cy="13"
          r={onDarkBg ? 11.5 : 13}
          fill="#FF5C00"
          stroke={onDarkBg ? '#FFFFFF' : 'none'}
          strokeWidth={onDarkBg ? 1.5 : 0}
        />
        <path
          d="M13 3c-3.8 3.5-5.5 7-5.5 10 0 3 2.5 5.5 5.5 5.5s5.5-2.5 5.5-5.5c0-3-1.7-6.5-5.5-10z"
          fill="white"
          opacity="0.88"
        />
        <circle cx="13" cy="13.5" r="2" fill="white" opacity="0.5" />
      </svg>
      {showText ? <span className={textClassName}>grabengo</span> : null}
    </span>
  );
}
