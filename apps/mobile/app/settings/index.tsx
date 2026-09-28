import { Button, IconButton, Screen, Text, useTheme } from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  FileText,
  Globe,
  HelpCircle,
  Palette,
  Shield,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Seo } from '@/components/Seo';
import { SettingsGroup, SettingsRow } from '@/components/SettingsRow';
import { useMe } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { env, isDemo } from '@/lib/env';
import { useSettings } from '@/stores/settings';

export default function Settings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { backend } = useServices();
  const me = useMe();
  const settings = useSettings();
  const icon = (I: typeof User, color = colors.text) => <I size={18} color={color} />;
  return (
    <Screen>
      <Seo title={`${t('settings.title')} · hopium.family`} path="/settings" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        />
        <Text variant="h2">{t('settings.title')}</Text>
      </View>
      <SettingsGroup>
        <SettingsRow
          testID="settings-account"
          icon={icon(User)}
          label={t('settings.account')}
          value={me.data ? `@${me.data.username}` : undefined}
          onPress={() => router.push('/settings/account')}
        />
        <SettingsRow
          icon={icon(Shield)}
          label={t('settings.security')}
          onPress={() => router.push('/settings/security')}
        />
        <SettingsRow
          icon={icon(Bell)}
          label={t('settings.notifications')}
          onPress={() => router.push('/settings/notifications')}
        />
        <SettingsRow
          icon={icon(Palette)}
          label={t('settings.appearance')}
          value={t(
            `settings.theme${settings.theme.charAt(0).toUpperCase()}${settings.theme.slice(1)}` as never,
          )}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingsRow
          testID="settings-language"
          icon={icon(Globe)}
          label={t('settings.language')}
          value={t(settings.language === 'id' ? 'settings.indonesian' : 'settings.english')}
          onPress={() => router.push('/settings/language')}
        />
        <SettingsRow
          icon={icon(ShieldCheck)}
          label={t('settings.kyc')}
          value={t(`settings.kycStatus.${me.data?.kycStatus ?? 'none'}`)}
          onPress={() => router.push('/settings/kyc')}
        />
      </SettingsGroup>
      <SettingsGroup title={t('settings.support')}>
        <SettingsRow
          icon={icon(FileText)}
          label={t('settings.legal')}
          onPress={() => router.push('/settings/legal')}
        />
        <SettingsRow
          icon={icon(HelpCircle)}
          label={t('settings.contact')}
          value={t('settings.supportEmail')}
          onPress={() => void Linking.openURL(`mailto:${t('settings.supportEmail')}`)}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          testID="settings-delete"
          icon={icon(Trash2, colors.loss)}
          label={t('settings.deleteAccount')}
          tone="loss"
          onPress={() => router.push('/settings/delete-account')}
        />
      </SettingsGroup>
      <Button
        testID="sign-out"
        label={t('settings.signOut')}
        variant="outline"
        className="mt-6"
        onPress={async () => {
          await backend.signOut();
          qc.clear();
        }}
      />
      <View className="mt-6 items-center gap-1">
        <Text variant="micro" tone="muted">
          {t('settings.version', { version: env.version, build: env.build })}
        </Text>
        <Text variant="micro" tone={isDemo ? 'warning' : 'muted'} testID="mode-indicator">
          {isDemo ? t('settings.demoIndicator') : t('settings.liveIndicator')}
        </Text>
      </View>
    </Screen>
  );
}
