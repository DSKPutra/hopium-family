import { Text, useTheme } from '@hopium/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CreatorLogo } from './CreatorLogo';

export const CREATOR_NAME = 'Dea Saka Kurnia Putra';

/** "Built by Dea Saka Kurnia Putra" with the creator's mark, plus the copyright line. */
export function CreatorCredit({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const year = new Date().getFullYear();
  return (
    <View
      testID="creator-credit"
      accessible
      accessibilityLabel={`${t('credit.builtBy')} ${CREATOR_NAME}. ${t('credit.copyright', { year, name: CREATOR_NAME })}`}
      className={`items-center gap-1.5 ${className ?? ''}`}
    >
      <View className="flex-row items-center gap-2">
        <CreatorLogo size={compact ? 18 : 24} ink={colors.text} />
        <Text variant={compact ? 'micro' : 'small'} tone="muted">
          {t('credit.builtBy')}{' '}
          <Text variant={compact ? 'micro' : 'small'} weight="semibold">
            {CREATOR_NAME}
          </Text>
        </Text>
      </View>
      <Text variant="micro" tone="muted" className="text-center">
        {t('credit.copyright', { year, name: CREATOR_NAME })}
      </Text>
    </View>
  );
}
