export default function GrabengoLogoMark({ size = 20, textClassName = 'grabengo-logo-text', className = '', showText = true }) {
  return (
    <span className={`grabengo-logo-mark ${className}`.trim()}>
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="13" cy="13" r="13" fill="#D4651A" />
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
