import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { LOGO_COLORS, LOGO_MARK } from '../brand/logo';
import { useTheme } from '../theme';
import { Text } from './Text';

export function LogoMark({ size = 32 }: { size?: number }) {
  const { capsule: c, rotation: r, seam, highlight: h } = LOGO_MARK;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="hopium.family">
      <Defs>
        <ClipPath id="hopium-capsule">
          <Rect x={c.x} y={c.y} width={c.width} height={c.height} rx={c.rx} />
        </ClipPath>
      </Defs>
      <G transform="translate(512 512) scale(1.12) translate(-522 -508)">
        <G transform={`rotate(${r.angle} ${r.cx} ${r.cy})`}>
          <G clipPath="url(#hopium-capsule)">
            <Rect x={c.x} y={c.y} width={c.width} height={c.height} fill={LOGO_COLORS.violet} />
            <Rect x={c.x} y={c.y} width={c.width} height={c.height / 2} fill={LOGO_COLORS.green} />
            <Rect
              x={c.x}
              y={seam.y - seam.thickness / 2}
              width={c.width}
              height={seam.thickness}
              fill={LOGO_COLORS.ink}
              opacity={0.9}
            />
          </G>
          <Rect
            x={h.x}
            y={h.y}
            width={h.width}
            height={h.height}
            rx={h.rx}
            fill="#FFFFFF"
            opacity={h.opacity}
          />
        </G>
        <Path d={LOGO_MARK.sparkPath} fill={LOGO_COLORS.gold} />
        <Path d={LOGO_MARK.sparkSmallPath} fill={LOGO_COLORS.gold} opacity={0.8} />
      </G>
    </Svg>
  );
}

/** `hopium.family` wordmark: always lowercase, the dot in Moon Gold. */
export function Wordmark({ size = 20 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="hopium.family"
      variant="h3"
      style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: -0.5, color: colors.text }}
    >
      hopium
      <Text
        accessibilityRole="none"
        variant="h3"
        style={{ fontSize: size, lineHeight: size * 1.2, color: LOGO_COLORS.gold }}
      >
        .
      </Text>
      family
    </Text>
  );
}

export function LogoLockup({ size = 28 }: { size?: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <LogoMark size={size} />
      <Wordmark size={size * 0.72} />
    </View>
  );
}
