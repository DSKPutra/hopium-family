import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { cn, focusRing } from '../cn';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface CopyableTextProps {
  value: string;
  display?: string;
  copyLabel: string;
  copiedLabel: string;
  onCopied?: () => void;
  className?: string;
}

export function CopyableText({
  value,
  display,
  copyLabel,
  copiedLabel,
  onCopied,
  className,
}: CopyableTextProps) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? copiedLabel : `${copyLabel}: ${value}`}
      onPress={async () => {
        await Clipboard.setStringAsync(value);
        haptics.success();
        setCopied(true);
        onCopied?.();
      }}
      className={cn(
        'border-border bg-surface min-h-[44px] flex-row items-center gap-2 rounded-md border px-3',
        focusRing,
        className,
      )}
    >
      <Text numeric className="flex-1" numberOfLines={1}>
        {display ?? value}
      </Text>
      {copied ? (
        <Check size={18} color={colors.gain} />
      ) : (
        <Copy size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}
