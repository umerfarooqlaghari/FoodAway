import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Same mark as admin-web GrabengoLogoMark — inline SVG, always visible. */
export default function GrabengoLogoMark({ size = 24, onDarkBg = false }) {
  const innerR = onDarkBg ? 11.5 : 13;
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {onDarkBg ? <Circle cx="13" cy="13" r="13" fill="#FFFFFF" /> : null}
      <Circle
        cx="13"
        cy="13"
        r={innerR}
        fill="#FF5C00"
        stroke={onDarkBg ? '#FFFFFF' : 'none'}
        strokeWidth={onDarkBg ? 1.5 : 0}
      />
      <Path
        d="M13 3c-3.8 3.5-5.5 7-5.5 10 0 3 2.5 5.5 5.5 5.5s5.5-2.5 5.5-5.5c0-3-1.7-6.5-5.5-10z"
        fill="#FFFFFF"
        opacity={0.88}
      />
      <Circle cx="13" cy="13.5" r="2" fill="#FFFFFF" opacity={0.5} />
    </Svg>
  );
}
