import type { FeedItem, FeedKind } from '@hopium/core';
import {
  Avatar,
  AssetLogo,
  Button,
  EmptyState,
  ErrorState,
  SegmentedControl,
  SkeletonList,
  Text,
  useTheme,
} from '@hopium/ui';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { PenLine } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { FeedItemView } from '@/components/feed/FeedItemView';
import { Seo } from '@/components/Seo';
import { useFeed, useLegendsBuying } from '@/hooks/queries';
import { errorMessage } from '@/lib/errors';
import { useRealtime } from '@/providers/RealtimeProvider';

function LegendsStrip() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const legends = useLegendsBuying();
  if (!legends.data?.length) return null;
  return (
    <View className="mb-3 gap-2">
      <Text variant="small" weight="semibold" tone="muted">
        {t('nav.legendsBuying')} 🔥
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
      >
        {legends.data.map((l) => (
          <Pressable
            key={l.postId}
            accessibilityRole="button"
            accessibilityLabel={t('home.legendBought', {
              username: `@${l.profile.username}`,
              symbol: l.trade.symbol,
            })}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: l.postId } })}
            className="w-16 items-center gap-1"
          >
            <View>
              <Avatar
                id={l.profile.id}
                name={l.profile.displayName}
                uri={l.profile.avatarUrl}
                size={56}
                ring={colors.primary}
              />
              <View className="rounded-pill border-bg absolute -bottom-1 -right-1 border-2">
                <AssetLogo
                  symbol={l.trade.symbol}
                  size={22}
                  shape={l.trade.assetClass === 'stock_token' ? 'squircle' : 'circle'}
                />
              </View>
            </View>
            <Text variant="micro" numberOfLines={1}>
              {l.profile.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [kind, setKind] = useState<FeedKind>('following');
  const feed = useFeed(kind);
  const { newPosts, resetNewPosts } = useRealtime();
  const listRef = useRef<{
    scrollToOffset: (p: { offset: number; animated: boolean }) => void;
  } | null>(null);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const showNew = useCallback(async () => {
    resetNewPosts();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    await feed.refetch();
  }, [feed, resetNewPosts]);

  const header = (
    <View>
      <AppHeader />
      <Text variant="small" tone="muted" className="mb-2">
        {t('home.gm')}
      </Text>
      <LegendsStrip />
      <SegmentedControl
        segments={[
          { value: 'following', label: t('home.following') },
          { value: 'trending', label: t('home.trending') },
          { value: 'theses', label: t('home.theses') },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          resetNewPosts();
        }}
        className="mb-3"
      />
    </View>
  );

  const empty = feed.isLoading ? (
    <SkeletonList count={4} variant="card" />
  ) : feed.error ? (
    <ErrorState
      title={t('errors.title')}
      message={errorMessage(t, feed.error)}
      retryLabel={t('common.retry')}
      onRetry={() => void feed.refetch()}
    />
  ) : kind === 'following' ? (
    <EmptyState
      title={t('home.emptyFollowingTitle')}
      body={t('home.emptyFollowingBody')}
      actionLabel={t('home.discoverTraders')}
      onAction={() => router.push('/leaderboard')}
    />
  ) : (
    <EmptyState
      title={t('home.emptyThesesTitle')}
      body={t('home.emptyThesesBody')}
      actionLabel={t('home.postThesis')}
      onAction={() => router.push('/thesis/new')}
    />
  );

  return (
    <SafeAreaView edges={['top']} className="bg-bg flex-1">
      <Seo title={t('meta.home')} description={t('meta.description')} path="/" />
      <View className="w-full max-w-[680px] flex-1 self-center">
        <FlashList<FeedItem>
          ref={listRef as never}
          data={items}
          keyExtractor={(i) => i.post.id}
          renderItem={({ item }) => (
            <View className="px-4 pb-3">
              <FeedItemView item={item} />
            </View>
          )}
          ListHeaderComponent={<View className="px-4">{header}</View>}
          ListEmptyComponent={<View className="px-4">{empty}</View>}
          onEndReached={() =>
            feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()
          }
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <SkeletonList count={1} variant="card" />
            ) : (
              <View className="h-24" />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void showNew()}
              tintColor={colors.primary}
            />
          }
        />
        {newPosts > 0 ? (
          <View className="absolute left-0 right-0 top-2 items-center" pointerEvents="box-none">
            <Button
              testID="new-posts-pill"
              label={t('home.newPosts', { count: newPosts })}
              size="sm"
              variant="gradient"
              onPress={() => void showNew()}
            />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.postThesis')}
          onPress={() => router.push('/thesis/new')}
          className="rounded-pill bg-secondary absolute bottom-5 right-5 h-14 w-14 items-center justify-center active:opacity-80"
          style={{ shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}
        >
          <PenLine size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
