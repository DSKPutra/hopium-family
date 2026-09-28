import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { cn } from '../cn';
import { fontFamily, typeScale, type TypeVariant } from '../tokens';

export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'gain'
  | 'loss'
  | 'warning'
  | 'onPrimary'
  | 'inherit';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const toneClass: Record<TextTone, string> = {
  default: 'text-text',
  muted: 'text-text-muted',
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  gain: 'text-gain',
  loss: 'text-loss',
  warning: 'text-warning',
  onPrimary: 'text-on-primary',
  inherit: '',
};

const HEADINGS: TypeVariant[] = ['display', 'h1', 'h2', 'h3'];

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: TextWeight;
  /** Space Grotesk + tabular numerals for prices and balances. */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
  className?: string;
}

function familyFor(variant: TypeVariant, weight: TextWeight | undefined, numeric: boolean): string {
  if (numeric)
    return weight === 'bold' || HEADINGS.includes(variant)
      ? fontFamily.heading
      : fontFamily.headingMedium;
  if (HEADINGS.includes(variant))
    return weight === 'medium' ? fontFamily.headingMedium : fontFamily.heading;
  if (weight === 'semibold' || weight === 'bold') return fontFamily.bodySemibold;
  if (weight === 'medium') return fontFamily.bodyMedium;
  return fontFamily.body;
}

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  numeric = false,
  align,
  className,
  style,
  ...rest
}: TextProps) {
  const scale = typeScale[variant];
  const heading = HEADINGS.includes(variant);
  return (
    <RNText
      accessibilityRole={
        heading && rest.accessibilityRole === undefined ? 'header' : rest.accessibilityRole
      }
      className={cn(toneClass[tone], className)}
      style={[
        {
          fontFamily: familyFor(variant, weight, numeric),
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          textAlign: align,
          ...(numeric ? { fontVariant: ['tabular-nums'] } : null),
          ...(heading ? { letterSpacing: variant === 'display' ? -1 : -0.3 } : null),
        },
        style,
      ]}
      {...rest}
    />
  );
}
