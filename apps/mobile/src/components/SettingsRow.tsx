import { Text, useTheme } from '@hopium/ui';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  tone = 'default',
  testID,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'loss';
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      className="web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary min-h-[52px] flex-row items-center gap-3 py-2 active:opacity-70"
    >
      {icon ? (
        <View className="bg-surface-2 h-9 w-9 items-center justify-center rounded-md">{icon}</View>
      ) : null}
      <Text weight="medium" tone={tone} className="flex-1">
        {label}
      </Text>
      {value ? (
        <Text variant="small" tone="muted">
          {value}
        </Text>
      ) : null}
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mt-5 gap-1">
      {title ? (
        <Text
          variant="micro"
          tone="muted"
          weight="semibold"
          style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
        >
          {title}
        </Text>
      ) : null}
      <View className="border-border bg-surface rounded-lg border px-3">{children}</View>
    </View>
  );
}
