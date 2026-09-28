import { Button, GradientView, LogoMark, Text, Wordmark, useTheme, useToast } from '@hopium/ui';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Seo } from '@/components/Seo';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

function FloatingCapsule({
  x,
  y,
  size,
  delay,
  rotate,
}: {
  x: string;
  y: string;
  size: number;
  delay: number;
  rotate: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 3200 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * t.value }, { rotate: `${rotate + t.value * 8}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x as `${number}%`, top: y as `${number}%`, opacity: 0.55 },
        style,
      ]}
    >
      <LogoMark size={size} />
    </Animated.View>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 520) - 32;
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const cards = [
    { title: t('auth.welcome.card1Title'), body: t('auth.welcome.card1Body') },
    { title: t('auth.welcome.card2Title'), body: t('auth.welcome.card2Body') },
    { title: t('auth.welcome.card3Title'), body: t('auth.welcome.card3Body') },
  ];
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index !== null && first?.index !== undefined) setIndex(first.index);
  }, []);

  const signIn = async (method: 'apple' | 'google') => {
    setBusy(method);
    try {
      await backend.signInWithProvider(method);
    } catch (err) {
      toast.show(errorMessage(t, err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView className="bg-bg flex-1">
      <Seo title={t('meta.home')} description={t('meta.description')} path="/welcome" />
      <GradientView
        opacity={0.12}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <FloatingCapsule x="8%" y="8%" size={56} delay={0} rotate={-20} />
      <FloatingCapsule x="78%" y="14%" size={40} delay={600} rotate={25} />
      <FloatingCapsule x="70%" y="42%" size={64} delay={300} rotate={-8} />
      <FloatingCapsule x="4%" y="46%" size={36} delay={900} rotate={40} />
      <View className="w-full max-w-[520px] flex-1 justify-between self-center px-4 pb-4">
        <View className="mt-10 items-center gap-3">
          <LogoMark size={88} />
          <Wordmark size={34} />
          <Text tone="muted">{t('brand.tagline')}</Text>
        </View>
        <View className="gap-3">
          <FlatList
            data={cards}
            horizontal
            pagingEnabled
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.title}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={VIEWABILITY}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item, index: i }) => (
              <View
                accessible
                accessibilityLabel={`${t('auth.welcome.slide', { index: i + 1, total: cards.length })}: ${item.title}`}
                style={{ width: cardWidth }}
                className="border-border bg-surface/90 gap-2 rounded-xl border p-5"
              >
                <Text variant="h2">{item.title}</Text>
                <Text tone="muted">{item.body}</Text>
              </View>
            )}
          />
          <View className="flex-row justify-center gap-1.5">
            {cards.map((c, i) => (
              <View
                key={c.title}
                className={
                  i === index
                    ? 'rounded-pill bg-primary h-1.5 w-5'
                    : 'rounded-pill bg-border h-1.5 w-1.5'
                }
              />
            ))}
          </View>
        </View>
        <View className="gap-3">
          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={999}
              style={{ height: 52, width: '100%' }}
              onPress={() => void signIn('apple')}
            />
          ) : Platform.OS === 'web' ? (
            <Button
              testID="continue-apple"
              label={t('auth.welcome.apple')}
              variant="secondary"
              size="lg"
              fullWidth
              loading={busy === 'apple'}
              onPress={() => void signIn('apple')}
            />
          ) : null}
          <Button
            testID="continue-google"
            label={t('auth.welcome.google')}
            variant="secondary"
            size="lg"
            fullWidth
            loading={busy === 'google'}
            onPress={() => void signIn('google')}
          />
          <Button
            testID="continue-email"
            label={t('auth.welcome.email')}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Mail size={18} color={colors.onPrimary} />}
            onPress={() => router.push('/sign-in')}
          />
          <Text variant="micro" tone="muted" align="center">
            {t('auth.welcome.legal')}{' '}
            <Text
              variant="micro"
              tone="primary"
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}
            >
              {t('auth.welcome.terms')}
            </Text>{' '}
            ·{' '}
            <Text
              variant="micro"
              tone="primary"
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
            >
              {t('auth.welcome.privacy')}
            </Text>
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'risk' } })}
            className="items-center py-1"
          >
            <Text variant="micro" tone="muted">
              {t('legal.risk')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
