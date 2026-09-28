import { bioSchema, displayNameSchema } from '@hopium/core';
import { Avatar, Button, Input, useToast } from '@hopium/ui';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { useMe } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';

export default function ProfileStep() {
  const { t } = useTranslation();
  const toast = useToast();
  const { backend } = useServices();
  const me = useMe();
  const [displayName, setDisplayName] = useState(me.data?.displayName || me.data?.username || '');
  const [bio, setBio] = useState(me.data?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(me.data?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const nameCheck = displayNameSchema.safeParse(displayName);
  const bioCheck = bioSchema.safeParse(bio);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show(t('onboarding.profile.photoPermission'), 'info');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    // Demo mode keeps the local URI; live mode uploads to Supabase Storage.
    if (!res.canceled && res.assets[0]) setAvatar(res.assets[0].uri);
  };

  return (
    <OnboardingFrame
      step={2}
      title={t('onboarding.profile.title')}
      cta={t('common.continue')}
      nextDisabled={!nameCheck.success || !bioCheck.success}
      loading={busy}
      onNext={async () => {
        setBusy(true);
        try {
          await backend.updateProfile({
            displayName: displayName.trim(),
            bio: bio.trim(),
            avatarUrl: avatar,
          });
          router.push('/onboarding/interests');
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <View className="items-center gap-3">
        <Avatar id={me.data?.id ?? 'me'} name={displayName || 'hopium'} uri={avatar} size={96} />
        <View className="flex-row gap-2">
          <Button
            label={t('onboarding.profile.pickPhoto')}
            size="sm"
            variant="secondary"
            onPress={() => void pick()}
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
        testID="display-name-input"
        label={t('onboarding.profile.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={40}
        error={
          displayName && !nameCheck.success
            ? validationMessage(t, nameCheck.error.issues[0]?.message)
            : null
        }
      />
      <Input
        label={t('onboarding.profile.bio')}
        value={bio}
        onChangeText={setBio}
        placeholder={t('onboarding.profile.bioPlaceholder')}
        multiline
        maxLength={160}
        style={{ minHeight: 88, textAlignVertical: 'top' }}
        helper={t('onboarding.profile.bioCount', { count: bio.length })}
        error={!bioCheck.success ? validationMessage(t, bioCheck.error.issues[0]?.message) : null}
      />
    </OnboardingFrame>
  );
}
