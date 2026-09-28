import { GradientView, Text, haptics, useTheme } from '@hopium/ui';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Compass, Home, LineChart, Trophy, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/hooks/useResponsive';

const ICONS = {
  index: Home,
  discover: Compass,
  trade: LineChart,
  leaderboard: Trophy,
  profile: User,
} as const;

function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  if (isDesktop) return null;
  return (
    <View
      accessibilityRole="tablist"
      className="border-border bg-surface flex-row items-end border-t"
      style={{ paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6 }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name as keyof typeof ICONS] ?? Home;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            haptics.light();
            navigation.navigate(route.name);
          }
        };
        if (route.name === 'trade') {
          return (
            <Pressable
              key={route.key}
              testID="tab-trade"
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              className="flex-1 items-center"
            >
              <View
                className="rounded-pill border-bg -mt-6 h-16 w-16 overflow-hidden border-4"
                style={{
                  shadowColor: colors.secondary,
                  shadowOpacity: 0.5,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <GradientView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={26} color={colors.onPrimary} strokeWidth={2.5} />
                </GradientView>
              </View>
              <Text
                variant="micro"
                weight="semibold"
                tone={focused ? 'default' : 'muted'}
                className="mt-0.5"
              >
                {label}
              </Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            className="min-h-[48px] flex-1 items-center justify-center gap-0.5"
          >
            <Icon
              size={24}
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={focused ? 2.5 : 2}
            />
            <Text variant="micro" weight="semibold" tone={focused ? 'default' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as BottomTabBarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="discover" options={{ title: t('nav.discover') }} />
      <Tabs.Screen name="trade" options={{ title: t('nav.trade') }} />
      <Tabs.Screen name="leaderboard" options={{ title: t('nav.leaderboard') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
    </Tabs>
  );
}
