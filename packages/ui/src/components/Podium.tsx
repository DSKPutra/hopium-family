import { Crown } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, focusRing } from '../cn';
import { useTheme } from '../theme';
import { medal } from '../tokens';
import { Avatar } from './Avatar';
import { Text } from './Text';

export interface PodiumEntry {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  value: string;
  rank: number;
}

export function Podium({
  entries,
  onPress,
  rankLabel,
}: {
  entries: PodiumEntry[];
  onPress: (e: PodiumEntry) => void;
  rankLabel: (rank: number) => string;
}) {
  const { colors } = useTheme();
  const order = [entries[1], entries[0], entries[2]];
  const heights = [96, 128, 80];
  const colorsByRank = [medal.silver, medal.gold, medal.bronze];
  return (
    <View className="flex-row items-end justify-center gap-3 px-2 pt-4">
      {order.map((e, i) => {
        if (!e) return <View key={`empty-${i}`} className="flex-1" />;
        const color = colorsByRank[i] as string;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${rankLabel(e.rank)} ${e.username} ${e.value}`}
            onPress={() => onPress(e)}
            className={cn('flex-1 items-center gap-2', focusRing)}
          >
            <Crown size={i === 1 ? 26 : 20} color={color} fill={color} />
            <Avatar
              id={e.id}
              name={e.name}
              uri={e.avatarUrl}
              size={i === 1 ? 64 : 52}
              ring={color}
            />
            <Text variant="small" weight="semibold" numberOfLines={1}>
              @{e.username}
            </Text>
            <Text variant="small" numeric weight="semibold" tone="gain">
              {e.value}
            </Text>
            <View
              style={{
                height: heights[i],
                backgroundColor: `${color}22`,
                borderColor: `${color}66`,
              }}
              className="w-full items-center justify-start rounded-t-lg border pt-2"
            >
              <Text variant="h2" numeric style={{ color: colors.text }}>
                {e.rank}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
