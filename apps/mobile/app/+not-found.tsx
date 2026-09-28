import { Button, EmptyState, Screen } from '@hopium/ui';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Seo } from '@/components/Seo';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Seo title={`${t('notFound.title')} · hopium.family`} />
      <EmptyState title={t('notFound.title')} body={t('notFound.body')} className="mt-16" />
      <Button
        label={t('common.goHome')}
        onPress={() => router.replace('/')}
        className="self-center"
      />
    </Screen>
  );
}
