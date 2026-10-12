import Svg, { Defs, Filter, FeGaussianBlur, G, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Personal brand mark of Dea Saka Kurnia Putra: a geometric "P" with a glowing
 * green seam. Vector recreation so it stays sharp at any size; `ink` adapts the
 * letterform to light or dark surfaces.
 */
export function CreatorLogo({
  size = 28,
  ink = '#07090A',
  accessibilityLabel,
}: {
  size?: number;
  ink?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="340 290 590 710"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Defs>
        <Filter id="dsk-glow" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation="14" />
        </Filter>
        <LinearGradient id="dsk-seam" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#22E05A" stopOpacity="0" />
          <Stop offset="0.35" stopColor="#22E05A" />
          <Stop offset="1" stopColor="#7DFF9E" />
        </LinearGradient>
      </Defs>
      {/* Bowl and chevron top stroke. */}
      <Path
        d="M366 316 H672 A229 229 0 0 1 672 774 H552 V700 Q556 656 612 652 H672 A112 112 0 0 0 672 428 H465 Z"
        fill={ink}
      />
      {/* Stem and the angled arm that meets the bowl at the seam. */}
      <Path d="M385 553 H755 L612 650 Q560 668 520 708 L510 716 V975 H385 Z" fill={ink} />
      {/* Glowing seam: soft halo, then the bright core line. */}
      <G opacity={0.85}>
        <Path
          d="M386 832 Q470 760 522 706 Q560 664 612 652 Q720 640 752 560 Q772 500 700 432"
          stroke="#22E05A"
          strokeWidth={26}
          fill="none"
          filter="url(#dsk-glow)"
        />
      </G>
      <Path
        d="M386 832 Q470 760 522 706 Q560 664 612 652 Q720 640 752 560 Q772 500 700 432"
        stroke="url(#dsk-seam)"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
