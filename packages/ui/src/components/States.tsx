import { AlertTriangle, ShieldAlert, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { useTheme } from '../theme';
import { Button } from './Button';
import { LogoMark } from './Logo';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('items-center gap-3 px-6 py-10', className)}>
      <View className="rounded-pill bg-surface-2 mb-1 h-20 w-20 items-center justify-center">
        {icon ?? <LogoMark size={48} />}
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center" className="max-w-[320px]">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-2" />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title: string;
  message?: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}

export function ErrorState({ title, message, retryLabel, onRetry, className }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" className={cn('items-center gap-3 px-6 py-10', className)}>
      <View className="rounded-pill bg-loss/15 h-16 w-16 items-center justify-center">
        <AlertTriangle size={28} color={colors.loss} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {message ? (
        <Text tone="muted" align="center" className="max-w-[320px]">
          {message}
        </Text>
      ) : null}
      <Button label={retryLabel} variant="secondary" onPress={onRetry} className="mt-2" />
    </View>
  );
}

export interface RiskBannerProps {
  message: string;
  title?: string;
  tone?: 'info' | 'warning' | 'danger';
  action?: ReactNode;
  className?: string;
  testID?: string;
}

/** Plain, serious risk messaging (never jokey). */
export function RiskBanner({
  message,
  title,
  tone = 'warning',
  action,
  className,
  testID,
}: RiskBannerProps) {
  const { colors } = useTheme();
  const color =
    tone === 'danger' ? colors.loss : tone === 'warning' ? colors.warning : colors.secondary;
  const Icon = tone === 'danger' ? ShieldAlert : tone === 'warning' ? AlertTriangle : Info;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      className={cn(
        'flex-row gap-3 rounded-md border p-3',
        tone === 'danger'
          ? 'border-loss/60 bg-loss/10'
          : tone === 'warning'
            ? 'border-warning/50 bg-warning/10'
            : 'border-secondary/40 bg-secondary/10',
        className,
      )}
    >
      <Icon size={18} color={color} style={{ marginTop: 2 }} />
      <View className="flex-1 gap-1">
        {title ? (
          <Text variant="small" weight="semibold">
            {title}
          </Text>
        ) : null}
        <Text variant="small" tone="default">
          {message}
        </Text>
        {action}
      </View>
    </View>
  );
}

export function DemoModePill({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      className="rounded-pill border-warning self-start border px-2 py-0.5"
      testID="demo-mode-pill"
    >
      <Text
        variant="micro"
        weight="semibold"
        tone="warning"
        style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        {label}
      </Text>
    </View>
  );
}
