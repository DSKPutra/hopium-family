import type { LeaderboardEntry, LeaderboardMetric, LeaderboardPeriod } from '@hopium/core';
import {
  Avatar,
  Card,
  GradientView,
  Podium,
  Screen,
  SegmentedControl,
  TierBadge,
  Text,
} from '@hopium/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { QueryState } from '@/components/QueryState';
import { Seo } from '@/components/Seo';
import { useLeaderboard } from '@/hooks/queries';
import { useNow } from '@/hooks/useNow';
import { countdown, useFormat } from '@/lib/format';

function useValueFormatter(metric: LeaderboardMetric) {
  const f = useFormat();
  const { t } = useTranslation();
  return (v: string) =>
    metric === 'pnl_pct'
      ? f.pct(v, { arrow: false })
      : metric === 'thesis_accuracy'
        ? f.pct(v, { signed: false, decimals: 0 })
        : t('leaderboard.copiersValue', { count: Number(v) });
}

function Movement({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useTranslation();
  if (entry.previousRank === null)
    return (
      <Text variant="micro" tone="accent">
        {t('leaderboard.new')}
      </Text>
    );
  const diff = entry.previousRank - entry.rank;
  if (diff === 0)
    return (
      <Text variant="micro" tone="muted">
        •
      </Text>
    );
  return (
    <Text
      variant="micro"
      numeric
      tone={diff > 0 ? 'gain' : 'loss'}
      accessibilityLabel={
        diff > 0
          ? t('leaderboard.movedUp', { count: diff })
          : t('leaderboard.movedDown', { count: -diff })
      }
    >
      {diff > 0 ? `▲${diff}` : `▼${-diff}`}
    </Text>
  );
}

function Row({
  entry,
  format,
  highlight,
}: {
  entry: LeaderboardEntry;
  format: (v: string) => string;
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('leaderboard.rankLabel', { rank: entry.rank })} @${entry.profile.username} ${format(entry.value)}`}
      onPress={() =>
        router.push({ pathname: '/user/[username]', params: { username: entry.profile.username } })
      }
      className={`min-h-[60px] flex-row items-center gap-3 py-2 ${highlight ? 'bg-primary/10 rounded-md px-2' : ''}`}
    >
      <View className="w-9 items-center">
        <Text numeric weight="bold">
          {entry.rank || '—'}
        </Text>
        <Movement entry={entry} />
      </View>
      <Avatar
        id={entry.profile.id}
        name={entry.profile.displayName || entry.profile.username}
        uri={entry.profile.avatarUrl}
        size={40}
      />
      <View className="flex-1 gap-0.5">
        <Text weight="semibold" numberOfLines={1}>
          @{entry.profile.username}
        </Text>
        <TierBadge tier={entry.profile.tier} label={t(`tiers.${entry.profile.tier}`)} />
      </View>
      <Text numeric weight="semibold" tone={entry.value.startsWith('-') ? 'loss' : 'gain'}>
        {format(entry.value)}
      </Text>
    </Pressable>
  );
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const now = useNow(1000);
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [metric, setMetric] = useState<LeaderboardMetric>('pnl_pct');
  const board = useLeaderboard(period, metric);
  const format = useValueFormatter(metric);

  return (
    <Screen footer={board.data?.me ? <MeRow entry={board.data.me} format={format} /> : undefined}>
      <Seo title={`${t('leaderboard.title')} · hopium.family`} path="/leaderboard" />
      <AppHeader title={t('leaderboard.title')} />
      {board.data ? (
        <View className="mb-3 overflow-hidden rounded-lg">
          <GradientView opacity={0.25} style={{ padding: 16, gap: 4 }}>
            <Text variant="h3">
              {t('leaderboard.seasonTitle', { name: board.data.season.name })}
            </Text>
            <Text variant="small" numeric>
              {t('leaderboard.seasonEnds', { time: countdown(t, board.data.season.endsAt, now) })}
            </Text>
            <Text variant="small" tone="muted">
              {t('leaderboard.seasonRewards')}
            </Text>
          </GradientView>
        </View>
      ) : null}
      <SegmentedControl
        segments={[
          { value: 'daily', label: t('leaderboard.today') },
          { value: 'weekly', label: t('leaderboard.week') },
          { value: 'season', label: t('leaderboard.season') },
          { value: 'all_time', label: t('leaderboard.allTime') },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <SegmentedControl
        className="mt-2"
        variant="underline"
        segments={[
          { value: 'pnl_pct', label: t('leaderboard.pnl') },
          { value: 'thesis_accuracy', label: t('leaderboard.accuracy') },
          { value: 'copiers', label: t('leaderboard.copied') },
        ]}
        value={metric}
        onChange={setMetric}
      />
      <QueryState
        query={board}
        isEmpty={(b) => b.entries.length === 0}
        empty={{ title: t('leaderboard.empty'), body: t('leaderboard.qualify') }}
      >
        {(b) => (
          <View>
            <Podium
              entries={b.entries.slice(0, 3).map((e) => ({
                id: e.profile.id,
                name: e.profile.displayName || e.profile.username,
                username: e.profile.username,
                avatarUrl: e.profile.avatarUrl,
                value: format(e.value),
                rank: e.rank,
              }))}
              onPress={(e) =>
                router.push({ pathname: '/user/[username]', params: { username: e.username } })
              }
              rankLabel={(r) => t('leaderboard.rankLabel', { rank: r })}
            />
            <Card padded={false} className="mt-2 px-3">
              {b.entries.slice(3).map((e) => (
                <Row
                  key={e.userId}
                  entry={e}
                  format={format}
                  highlight={e.userId === b.me?.userId}
                />
              ))}
            </Card>
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

function MeRow({ entry, format }: { entry: LeaderboardEntry; format: (v: string) => string }) {
  const { t } = useTranslation();
  return (
    <View testID="my-rank" className="gap-1">
      <Text variant="micro" tone="muted" weight="semibold" style={{ textTransform: 'uppercase' }}>
        {t('leaderboard.yourRank')}
      </Text>
      {entry.rank > 0 ? (
        <Row entry={entry} format={format} highlight />
      ) : (
        <View className="flex-row items-center gap-3 py-1">
          <Avatar
            id={entry.profile.id}
            name={entry.profile.displayName || entry.profile.username}
            uri={entry.profile.avatarUrl}
            size={36}
          />
          <View className="flex-1">
            <Text weight="semibold">
              @{entry.profile.username} · {t('leaderboard.unranked')}
            </Text>
            <Text variant="small" tone="muted">
              {t('leaderboard.qualify')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
