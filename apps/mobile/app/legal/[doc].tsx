import { EmptyState, Screen } from '@hopium/ui';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Markdown } from '@/components/Markdown';
import { Seo } from '@/components/Seo';
import { SubHeader } from '@/components/SubHeader';
import { LEGAL_DOCS } from '@/legal/content';

const DOCS = ['terms', 'privacy', 'risk'] as const;
type Doc = (typeof DOCS)[number];

export default function LegalDoc() {
  const { doc = 'terms' } = useLocalSearchParams<{ doc: string }>();
  const { t, i18n } = useTranslation();
  const valid = (DOCS as readonly string[]).includes(doc);
  const source = valid
    ? (LEGAL_DOCS[`${doc}.${i18n.language === 'id' ? 'id' : 'en'}`] ?? LEGAL_DOCS[`${doc}.en`])
    : undefined;
  const title = valid ? t(`legal.${doc as Doc}`) : t('legal.notFound');
  return (
    <Screen>
      <Seo title={`${title} · hopium.family`} path={`/legal/${doc}`} />
      <SubHeader title={title} fallback="/" />
      {source ? <Markdown source={source} /> : <EmptyState title={t('legal.notFound')} />}
    </Screen>
  );
}
