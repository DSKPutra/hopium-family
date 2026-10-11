import { Button, Card, QRCode, Screen, Text, useTheme, useToast } from '@hopium/ui';
import { Download, Plus, Share, Smartphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Seo } from '@/components/Seo';
import { SubHeader } from '@/components/SubHeader';
import { promptInstall, usePwa } from '@/lib/pwa';

/** Stable link to the newest Android build attached to a GitHub release. */
export const ANDROID_APK_URL =
  process.env.EXPO_PUBLIC_ANDROID_APK_URL ||
  'https://github.com/DSKPutra/hopium-family/releases/latest/download/hopium-family.apk';
const SITE_URL = 'https://hopium-family.vercel.app';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="bg-primary/15 h-7 w-7 items-center justify-center rounded-full">
        <Text variant="small" weight="bold" tone="primary">
          {n}
        </Text>
      </View>
      <View className="flex-1 flex-row flex-wrap items-center gap-1 pt-1">{children}</View>
    </View>
  );
}

export default function GetApp() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const pwa = usePwa();

  const install = async () => {
    if (await promptInstall()) toast.show(t('getApp.installed'), 'success');
  };

  return (
    <Screen>
      <Seo title={`${t('getApp.title')} · hopium.family`} path="/get-app" />
      <SubHeader title={t('getApp.title')} fallback="/" />
      <Text tone="muted" className="mb-4">
        {t('getApp.body')}
      </Text>

      {pwa.isStandalone ? (
        <Card className="mb-4 gap-1" testID="get-app-installed">
          <Text weight="semibold">{t('getApp.alreadyTitle')}</Text>
          <Text variant="small" tone="muted">
            {t('getApp.alreadyBody')}
          </Text>
        </Card>
      ) : null}

      {/* Android: browser install (PWA) or the standalone APK. */}
      <Card className="mb-4 gap-3" testID="get-app-android">
        <View className="flex-row items-center gap-2">
          <Smartphone size={20} color={colors.primary} />
          <Text variant="h3">{t('getApp.androidTitle')}</Text>
        </View>
        {pwa.canPrompt ? (
          <Button
            testID="install-pwa"
            label={t('getApp.installButton')}
            icon={<Plus size={18} color={colors.onPrimary} />}
            onPress={() => void install()}
          />
        ) : (
          <Text variant="small" tone="muted">
            {t('getApp.androidMenu')}
          </Text>
        )}
        <Button
          testID="download-apk"
          variant="outline"
          label={t('getApp.apkButton')}
          icon={<Download size={18} color={colors.text} />}
          onPress={() => void Linking.openURL(ANDROID_APK_URL)}
        />
        <Text variant="micro" tone="muted">
          {t('getApp.apkNote')}
        </Text>
      </Card>

      {/* iPhone / iPad: Safari "Add to Home Screen". */}
      <Card className="mb-4 gap-3" testID="get-app-ios">
        <View className="flex-row items-center gap-2">
          <Smartphone size={20} color={colors.secondary} />
          <Text variant="h3">{t('getApp.iosTitle')}</Text>
        </View>
        <Step n={1}>
          <Text variant="small">{t('getApp.iosStep1')}</Text>
        </Step>
        <Step n={2}>
          <Text variant="small">{t('getApp.iosStep2')}</Text>
          <Share size={16} color={colors.text} accessibilityLabel={t('common.share')} />
        </Step>
        <Step n={3}>
          <Text variant="small">{t('getApp.iosStep3')}</Text>
        </Step>
        <Text variant="micro" tone="muted">
          {t('getApp.iosNote')}
        </Text>
      </Card>

      {pwa.platform === 'desktop' && !pwa.isStandalone ? (
        <Card className="mb-4 items-center gap-3" testID="get-app-qr">
          <Text weight="semibold">{t('getApp.scanTitle')}</Text>
          <QRCode value={`${SITE_URL}/get-app`} size={180} label={t('getApp.scanBody')} />
          <Text variant="small" tone="muted">
            {t('getApp.scanBody')}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
