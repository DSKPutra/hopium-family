import { bioSchema, displayNameSchema, type Profile } from '@hopium/core';
import { Avatar, Button, Card, Input, Screen, Switch, Text, useToast } from '@hopium/ui';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SubHeader } from '@/components/SubHeader';
import { useMe, useSession } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';

export default function Account() {
  const { t } = useTranslation();
  const me = useMe();
  if (!me.data) {
    return (
      <Screen>
        <SubHeader title={t('settings.account')} />
      </Screen>
    );
  }
  return <AccountForm profile={me.data} />;
}

function AccountForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { backend } = useServices();
  const session = useSession();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const [busy, setBusy] = useState(false);
  const nameOk = displayNameSchema.safeParse(displayName);
  const bioOk = bioSchema.safeParse(bio);
  return (
    <Screen>
      <SubHeader title={t('profile.edit.title')} />
      <View className="gap-4">
        <View className="items-center gap-2">
          <Avatar id={profile.id} name={displayName || profile.username} uri={avatar} size={88} />
          <View className="flex-row gap-2">
            <Button
              label={t('onboarding.profile.pickPhoto')}
              size="sm"
              variant="secondary"
              onPress={async () => {
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.7,
                });
                if (!res.canceled && res.assets[0]) setAvatar(res.assets[0].uri);
              }}
            />
            {avatar ? (
              <Button
                label={t('onboarding.profile.useGenerated')}
                size="sm"
                variant="ghost"
                onPress={() => setAvatar(null)}
              />
            ) : null}
          </View>
        </View>
        <Input
          label={t('onboarding.profile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={40}
          error={!nameOk.success ? validationMessage(t, nameOk.error.issues[0]?.message) : null}
        />
        <Input
          label={t('onboarding.profile.bio')}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          helper={t('onboarding.profile.bioCount', { count: bio.length })}
          error={!bioOk.success ? validationMessage(t, bioOk.error.issues[0]?.message) : null}
        />
        <Button
          label={t('common.save')}
          disabled={!nameOk.success || !bioOk.success}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await backend.updateProfile({ displayName, bio, avatarUrl: avatar });
              toast.show(t('profile.edit.saved'), 'success');
            } catch (err) {
              toast.show(errorMessage(t, err), 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Card className="gap-1">
          <Text variant="small" tone="muted">
            {t('settings.email')}
          </Text>
          <Text weight="medium">{session.data?.email ?? '—'}</Text>
          <Text variant="small" tone="muted" className="mt-2">
            {t('settings.linkedLogins')}
          </Text>
          <Text weight="medium">
            {t('settings.signInMethod', { method: session.data?.method ?? 'email' })}
          </Text>
        </Card>
        <Card className="gap-0">
          <Text variant="small" weight="semibold" tone="muted">
            {t('settings.privacy')}
          </Text>
          <Switch
            label={t('settings.holdingsPublic')}
            description={t('settings.holdingsPublicHint')}
            value={profile.holdingsPublic}
            onValueChange={(v) => void backend.updateProfile({ holdingsPublic: v })}
          />
          <Switch
            label={t('settings.exactAmounts')}
            description={t('settings.exactAmountsHint')}
            value={profile.shareExactAmounts}
            onValueChange={(v) => void backend.updateProfile({ shareExactAmounts: v })}
          />
        </Card>
      </View>
    </Screen>
  );
}
