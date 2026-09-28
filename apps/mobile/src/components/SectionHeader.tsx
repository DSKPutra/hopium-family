import { Text } from '@hopium/ui';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export function SectionHeader({
  title,
  href,
  actionLabel,
  right,
}: {
  title: string;
  href?: Href;
  actionLabel?: string;
  right?: ReactNode;
}) {
  return (
    <View className="mb-2 mt-6 flex-row items-center justify-between">
      <Text variant="h3">{title}</Text>
      {href && actionLabel ? (
        <Link href={href} className="min-h-[44px] justify-center py-2">
          <Text variant="small" tone="primary" weight="semibold">
            {actionLabel}
          </Text>
        </Link>
      ) : (
        right
      )}
    </View>
  );
}
