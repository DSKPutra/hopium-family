import {
  Avatar,
  Button,
  Card,
  ErrorState,
  IconButton,
  Screen,
  Skeleton,
  Text,
  TierBadge,
  useTheme,
} from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { PostActions } from '@/components/feed/PostActions';
import { ThesisBody } from '@/components/feed/FeedItemView';
import { PriceChart } from '@/components/PriceChart';
import { Seo } from '@/components/Seo';
import { useCandles, useThesis } from '@/hooks/queries';
import { errorMessage } from '@/lib/errors';
import { timeAgo, useFormat } from '@/lib/format';
import { useTrade } from '@/providers/TradeProvider';

export default function ThesisDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const { openOrder } = useTrade();
  const q = useThesis(id);
  const detail = q.data;
  const candles = useCandles(detail?.thesis.assetId, '1W');

  if (q.isLoading)
    return (
      <Screen>
        <Skeleton height={320} className="mt-6" />
      </Screen>
    );
  if (q.error || !detail) {
    return (
      <Screen>
        <ErrorState
          title={t('theses.notFound')}
          message={q.error ? errorMessage(t, q.error) : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => void q.refetch()}
        />
      </Screen>
    );
  }
  const { thesis, author, item } = detail;
  const perp = [
    'btc',
    'eth',
    'sol',
    'xrp',
    'doge',
    'avax',
    'link',
    'arb',
    'sui',
    'ton',
    'hope',
    'fam',
  ].includes(thesis.assetId);
  return (
    <Screen
      footer={
        thesis.status === 'active' ? (
          <View className="flex-row gap-3">
            <Button
              testID="take-trade"
              label={t('theses.takeTrade')}
              variant={thesis.direction === 'long' ? 'gain' : 'danger'}
              className="flex-1"
              onPress={() =>
                thesis.direction === 'short' && perp
                  ? router.push({
                      pathname: '/perps/[market]',
                      params: { market: `${thesis.assetId}-perp` },
                    })
                  : openOrder({
                      assetId: thesis.assetId,
                      side: thesis.direction === 'long' ? 'buy' : 'sell',
                    })
              }
            />
          </View>
        ) : undefined
      }
    >
      <Seo
        title={t('meta.thesis', {
          direction: thesis.direction,
          symbol: thesis.symbol,
          username: author.username,
        })}
        description={thesis.body.slice(0, 150)}
        path={`/t/${thesis.id}`}
      />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="h2">{t('theses.detailTitle')}</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({ pathname: '/user/[username]', params: { username: author.username } })
        }
        className="mb-3 flex-row items-center gap-3"
      >
        <Avatar
          id={author.id}
          name={author.displayName || author.username}
          uri={author.avatarUrl}
          size={44}
        />
        <View className="flex-1">
          <Text weight="semibold">@{author.username}</Text>
          <Text variant="micro" tone="muted">
            {timeAgo(t, thesis.createdAt)}
          </Text>
        </View>
        <TierBadge tier={author.tier} label={t(`tiers.${author.tier}`)} />
      </Pressable>
      <ThesisBody item={{ thesis }} compact />
      <View className="mt-4">
        {candles.data ? (
          <PriceChart
            candles={candles.data}
            color={colors.secondary}
            accessibilityLabel={t('asset.chartLabel', { symbol: thesis.symbol })}
            formatPrice={f.price}
            locale={f.locale}
            lines={[
              { price: thesis.entryPrice, color: colors.textMuted, label: t('feed.entry') },
              { price: thesis.targetPrice, color: colors.gain, label: t('feed.target') },
              {
                price: thesis.invalidationPrice,
                color: colors.loss,
                label: t('feed.invalidation'),
              },
            ]}
          />
        ) : (
          <Skeleton height={220} />
        )}
      </View>
      <Card className="mt-4 gap-2">
        <Text>{thesis.body}</Text>
        {thesis.status !== 'active' ? (
          <Text variant="small" tone="muted" numeric>
            {t('theses.maxFavorable')}: {f.pct(thesis.maxFavorablePct)} ·{' '}
            {thesis.resolvedAt ? t('theses.resolved', { time: timeAgo(t, thesis.resolvedAt) }) : ''}
          </Text>
        ) : null}
        <PostActions item={item} />
      </Card>
      <Button
        label={t('feed.commentsTitle')}
        variant="ghost"
        className="mt-2"
        onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post.id } })}
      />
    </Screen>
  );
}
