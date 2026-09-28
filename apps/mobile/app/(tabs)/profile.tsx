import { EmptyState, Screen, SkeletonList } from '@hopium/ui';
import { useTranslation } from 'react-i18next';

import { ProfileView } from '@/components/ProfileView';
import { useMe } from '@/hooks/queries';

export default function MyProfile() {
  const { t } = useTranslation();
  const me = useMe();
  if (me.isLoading)
    return (
      <Screen>
        <SkeletonList count={4} variant="card" />
      </Screen>
    );
  if (!me.data)
    return (
      <Screen>
        <EmptyState title={t('profile.notFound')} />
      </Screen>
    );
  return <ProfileView username={me.data.username} own />;
}
