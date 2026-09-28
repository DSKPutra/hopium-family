import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View } from 'react-native';

import { gradientFor, initialsOf } from './generated';
import { Text } from './Text';

export interface AssetLogoProps {
  symbol: string;
  uri?: string;
  size?: number;
  /** Stock tokens get a squircle to tell them apart from coins. */
  shape?: 'circle' | 'squircle';
}

export function AssetLogo({ symbol, uri, size = 40, shape = 'circle' }: AssetLogoProps) {
  const [failed, setFailed] = useState(false);
  const radius = shape === 'circle' ? size / 2 : size * 0.28;
  const [c1, c2] = gradientFor(`asset:${symbol}`);
  const label = symbol.replace(/x$/, '');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            weight="bold"
            style={{
              color: '#FFFFFF',
              fontSize: size * (label.length > 3 ? 0.28 : 0.34),
              lineHeight: size * 0.42,
            }}
          >
            {initialsOf(label).length === 2 && label.length <= 4
              ? label.slice(0, 4).toUpperCase()
              : initialsOf(label)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}
