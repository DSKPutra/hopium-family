import { dec, div, gt, mul, round, thesisProgress, type FeedItem } from '@hopium/core';
import { AssetLogo, Avatar, Card, PnLBadge, ProgressToTarget, TierBadge, Text } from '@hopium/ui';
import { router } from 'expo-router';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useLivePrice } from '@/hooks/useLivePrice';
import { useNow } from '@/hooks/useNow';
import { countdown, timeAgo, useFormat } from '@/lib/format';
import { useTrade } from '@/providers/TradeProvider';
import { PostActions } from './PostActions';

function AuthorLine({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const { author } = item;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`@${author.username}`}
      onPress={() =>
        router.push({ pathname: '/user/[username]', params: { username: author.username } })
      }
      className="flex-row items-center gap-2.5"
    >
      <Avatar
        id={author.id}
        name={author.displayName || author.username}
        uri={author.avatarUrl}
        size={40}
      />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text weight="semibold" numberOfLines={1} className="shrink">
            @{author.username}
          </Text>
          <TierBadge tier={author.tier} label={t(`tiers.${author.tier}`)} compact />
        </View>
        <Text variant="micro" tone="muted">
          {timeAgo(t, item.post.createdAt, now)}
        </Text>
      </View>
    </Pressable>
  );
}

function TradeBody({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  const f = useFormat();
  const trade = item.trade;
  const live = useLivePrice(trade?.assetId);
  if (!trade) return null;
  const current = live?.price;
  const pnl =
    current && gt(trade.price, 0)
      ? round(
          mul(
            div(dec(current).minus(dec(trade.price)).toFixed(), trade.price),
            trade.side === 'buy' ? 100 : -100,
          ),
          4,
        )
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trade.side === 'buy' ? t('feed.bought') : t('feed.sold')} ${trade.symbol}`}
      onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol: trade.symbol } })}
      className="border-border bg-surface-2 flex-row items-center gap-3 rounded-md border p-3"
    >
      <AssetLogo
        symbol={trade.symbol}
        size={36}
        shape={trade.assetClass === 'stock_token' ? 'squircle' : 'circle'}
      />
      <View className="flex-1 gap-0.5">
        <Text weight="semibold">
          <Text weight="semibold" tone={trade.side === 'buy' ? 'gain' : 'loss'}>
            {trade.side === 'buy' ? t('feed.bought') : t('feed.sold')}
          </Text>{' '}
          {trade.symbol}
        </Text>
        <Text variant="small" tone="muted" numeric>
          {item.amountsVisible
            ? f.usd(trade.notional)
            : item.sizeBucket
              ? t(`feed.size.${item.sizeBucket}`)
              : ''}{' '}
          · {t('feed.entry')} {f.price(trade.price)}
        </Text>
      </View>
      {pnl ? (
        <View className="items-end gap-0.5">
          <PnLBadge pct={pnl} locale={f.locale} />
          <Text variant="micro" tone="muted">
            {t('feed.sinceTrade')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ThesisBody({
  item,
  compact = false,
}: {
  item: Pick<FeedItem, 'thesis'>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow(30_000);
  const th = item.thesis;
  const live = useLivePrice(th?.assetId);
  if (!th) return null;
  const current = live?.price ?? th.entryPrice;
  const progress =
    th.status === 'hit'
      ? 1
      : th.status === 'invalidated'
        ? -1
        : thesisProgress(
            th.direction,
            th.entryPrice,
            th.targetPrice,
            th.invalidationPrice,
            current,
          );
  const long = th.direction === 'long';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${long ? t('feed.long') : t('feed.short')} ${th.symbol}`}
      onPress={() => router.push({ pathname: '/thesis/[id]', params: { id: th.id } })}
      className="border-border bg-surface-2 gap-3 rounded-md border p-3"
    >
      <View className="flex-row items-center gap-2">
        <View
          className={
            long ? 'rounded-pill bg-gain/15 px-2 py-0.5' : 'rounded-pill bg-loss/15 px-2 py-0.5'
          }
        >
          <Text variant="micro" weight="semibold" tone={long ? 'gain' : 'loss'}>
            {long ? `▲ ${t('feed.long')}` : `▼ ${t('feed.short')}`}
          </Text>
        </View>
        <Text weight="semibold">{th.symbol}</Text>
        <View className="flex-1" />
        <View className="rounded-pill border-border border px-2 py-0.5">
          <Text
            variant="micro"
            weight="semibold"
            tone={th.status === 'hit' ? 'gain' : th.status === 'active' ? 'primary' : 'muted'}
          >
            {t(`theses.status.${th.status}`)}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Text variant="small" tone="muted" numeric>
          {t('feed.target')}{' '}
          <Text variant="small" numeric weight="semibold">
            {f.price(th.targetPrice)}
          </Text>
        </Text>
        <Text variant="small" tone="muted" numeric>
          {t('feed.invalidation')}{' '}
          <Text variant="small" numeric weight="semibold">
            {f.price(th.invalidationPrice)}
          </Text>
        </Text>
        {th.status === 'active' ? (
          <Text variant="small" tone="muted" numeric>
            {t('feed.timeLeft', { time: countdown(t, th.timeframeEnd, now) })}
          </Text>
        ) : null}
      </View>
      <ProgressToTarget
        progress={progress}
        leftLabel={f.price(th.invalidationPrice)}
        rightLabel={f.price(th.targetPrice)}
        accessibilityLabel={t('feed.progress')}
      />
      {!compact ? (
        <Text variant="small" numberOfLines={3}>
          {th.body}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MilestoneBody({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  const m = item.post.milestone;
  if (!m) return null;
  return (
    <View className="border-accent/40 bg-accent/10 rounded-md border p-3">
      <Text weight="semibold">
        {t(`feed.milestone.${m.type}`, {
          rank: m.rank ?? '',
          icon: '🏅',
          tier: m.tier ? t(`tiers.${m.tier}`) : '',
        })}
      </Text>
    </View>
  );
}

export const FeedItemView = memo(function FeedItemView({ item }: { item: FeedItem }) {
  const { openOrder } = useTrade();
  return (
    <Card className="gap-3" testID={`feed-item-${item.post.kind}`}>
      <AuthorLine item={item} />
      {item.post.kind === 'trade' ? <TradeBody item={item} /> : null}
      {item.post.kind === 'thesis' ? <ThesisBody item={item} /> : null}
      {item.post.kind === 'milestone' ? <MilestoneBody item={item} /> : null}
      {item.post.body ? <Text>{item.post.body}</Text> : null}
      <PostActions
        item={item}
        onCopy={
          item.post.kind === 'trade' && item.trade
            ? () =>
                openOrder({ assetId: item.trade!.assetId, side: item.trade!.side, copyFrom: item })
            : undefined
        }
      />
    </Card>
  );
});
