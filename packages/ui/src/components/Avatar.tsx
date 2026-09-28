import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { gradientFor, initialsOf } from './generated';
import { Text } from './Text';

export interface AvatarProps {
  id: string;
  name: string;
  uri?: string | null;
  size?: number;
  ring?: string;
  className?: string;
}

/** Profile photo, or a generated gradient with initials (no real photos in demo data). */
export function Avatar({ id, name, uri, size = 40, ring, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [c1, c2] = gradientFor(id);
  const radius = size / 2;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      className={cn('overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
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
            style={{ color: '#FFFFFF', fontSize: size * 0.38, lineHeight: size * 0.46 }}
          >
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export interface AvatarStackProps {
  people: { id: string; name: string; uri?: string | null }[];
  max?: number;
  size?: number;
  moreLabel?: (count: number) => string;
  ringColor: string;
}

export function AvatarStack({
  people,
  max = 5,
  size = 28,
  moreLabel,
  ringColor,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size / 3, zIndex: shown.length - i }}>
          <Avatar id={p.id} name={p.name} uri={p.uri} size={size} ring={ringColor} />
        </View>
      ))}
      {more > 0 && moreLabel ? (
        <Text variant="small" tone="muted" className="ml-2">
          {moreLabel(more)}
        </Text>
      ) : null}
    </View>
  );
}
