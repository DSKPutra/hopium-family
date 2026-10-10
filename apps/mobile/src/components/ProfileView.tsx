import { pctChange, type PortfolioRange, type ThesisStatus } from '@hopium/core';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  GradientView,
  IconButton,
  PnLBadge,
  SegmentedControl,
  Screen,
  SkeletonList,
  Sparkline,
  TierBadge,
  Text,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, BellOff, MoreHorizontal, Settings, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ThesisBody } from '@/components/feed/FeedItemView';
import { Seo } from '@/components/Seo';
import {
  usePortfolioHistory,
  useToggleFollow,
  useUser,
  useUserBadges,
  useUserHoldings,
  useUserTheses,
  useUserTrades,
} from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { timeAgo, useFormat } from '@/lib/format';
import { useShare } from '@/lib/share';

type Tab = 'trades' | 'theses' | 'holdings' | 'badges';

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'gain' | 'loss' | 'default';
}) {
  return (
    <View className="min-w-[30%] flex-1 items-center gap-0.5 py-2">
      <Text numeric weight="bold" tone={tone ?? 'default'}>
        {value}
      </Text>
      <Text variant="micro" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function ProfileView({ username, own = false }: { username: string; own?: boolean }) {
  const { t, i18n } = useTranslation();
  const share = useShare();
  const { colors } = useTheme();
  const f = useFormat();
  const toast = useToast();
  const qc = useQueryClient();
  const { backend } = useServices();
  const userQ = useUser(username);
  const user = userQ.data;
  const [tab, setTab] = useState<Tab>('trades');
  const [range, setRange] = useState<PortfolioRange>('1M');
  const [thesisFilter, setThesisFilter] = useState<ThesisStatus | 'all'>('all');
  const [menu, setMenu] = useState(false);
  const trades = useUserTrades(user?.profile.id);
  const theses = useUserTheses(user?.profile.id, thesisFilter);
  const holdings = useUserHoldings(tab === 'holdings' ? user?.profile.id : undefined);
  const badges = useUserBadges(tab === 'badges' ? user?.profile.id : undefined);
  const history = usePortfolioHistory(user?.profile.id, range);
  const follow = useToggleFollow();
  const values = useMemo(() => (history.data ?? []).map((p) => Number(p.value)), [history.data]);

  if (userQ.isLoading)
    return (
      <Screen>
        <SkeletonList count={4} variant="card" />
      </Screen>
    );
  if (userQ.error || !user) {
    return (
      <Screen>
        <ErrorState
          title={t('profile.notFound')}
          message={userQ.error ? errorMessage(t, userQ.error) : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => void userQ.refetch()}
        />
      </Screen>
    );
  }
  const { profile, stats } = user;
  const joined = new Date(profile.createdAt).toLocaleDateString(f.locale, {
    month: 'short',
    year: 'numeric',
  });
  const firstVal = history.data?.[0]?.value;
  const lastVal = history.data?.at(-1)?.value;
  const changePct = firstVal && lastVal ? pctChange(firstVal, lastVal) : '0';

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['user'] });
  };

  return (
    <Screen
      edges={['top']}
      contentClassName="px-0"
      onRefresh={refresh}
      refreshing={userQ.isRefetching}
    >
      <Seo
        title={t('meta.user', { username: profile.username })}
        description={profile.bio}
        path={`/u/${profile.username}`}
      />
      <GradientView opacity={0.5} style={{ height: 110 }} />
      <View className="-mt-12 gap-3 px-4">
        <View className="flex-row items-end justify-between">
          <Avatar
            id={profile.id}
            name={profile.displayName || profile.username}
            uri={profile.avatarUrl}
            size={88}
            ring={colors.bg}
          />
          <View className="flex-row gap-1 pb-1">
            <IconButton
              accessibilityLabel={t('common.share')}
              variant="surface"
              icon={<Share2 size={18} color={colors.text} />}
              onPress={() =>
                void share(
                  t('meta.user', { username: profile.username }),
                  `https://hopium.family/u/${profile.username}`,
                )
              }
            />
            {own ? (
              <IconButton
                accessibilityLabel={t('profile.settings')}
                variant="surface"
                icon={<Settings size={18} color={colors.text} />}
                onPress={() => router.push('/settings')}
              />
            ) : (
              <>
                <IconButton
                  accessibilityLabel={
                    user.notifyOnTrade ? t('profile.notifyOn') : t('profile.notifyOff')
                  }
                  variant="surface"
                  icon={
                    user.notifyOnTrade ? (
                      <Bell size={18} color={colors.primary} fill={colors.primary} />
                    ) : (
                      <BellOff size={18} color={colors.text} />
                    )
                  }
                  onPress={async () => {
                    await backend.setNotifyOnTrade(profile.id, !user.notifyOnTrade);
                    if (!user.notifyOnTrade)
                      toast.show(
                        t('profile.notifyEnabled', { username: `@${profile.username}` }),
                        'success',
                      );
                    refresh();
                  }}
                />
                <IconButton
                  accessibilityLabel={t('profile.moreActions')}
                  variant="surface"
                  icon={<MoreHorizontal size={18} color={colors.text} />}
                  onPress={() => setMenu(true)}
                />
              </>
            )}
          </View>
        </View>
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text variant="h2" className="shrink">
              {profile.displayName || profile.username}
            </Text>
            <TierBadge tier={profile.tier} label={t(`tiers.${profile.tier}`)} />
          </View>
          <Text tone="muted">@{profile.username}</Text>
          {profile.bio ? <Text>{profile.bio}</Text> : null}
          <Text variant="small" tone="muted">
            {t('profile.joined', { date: joined })}
          </Text>
        </View>
        {own ? (
          <Button
            label={t('profile.editProfile')}
            variant="secondary"
            onPress={() => router.push('/settings/account')}
          />
        ) : (
          <Button
            testID="profile-follow"
            label={user.isFollowing ? t('profile.unfollow') : t('profile.follow')}
            variant={user.isFollowing ? 'secondary' : 'primary'}
            onPress={() =>
              follow.mutate({
                userId: profile.id,
                username: profile.username,
                following: user.isFollowing,
              })
            }
          />
        )}
        <Card padded={false} className="flex-row flex-wrap px-2">
          <Stat
            label={t('profile.pnl')}
            value={f.pct(stats.pnlPct, { arrow: true })}
            tone={stats.pnlPct.startsWith('-') ? 'loss' : 'gain'}
          />
          <Stat
            label={t('profile.winRate')}
            value={f.pct(stats.winRatePct, { signed: false, decimals: 0 })}
          />
          <Stat
            label={t('profile.accuracy')}
            value={f.pct(stats.thesisAccuracyPct, { signed: false, decimals: 0 })}
          />
          <Stat label={t('profile.followers')} value={f.compact(String(stats.followers))} />
          <Stat label={t('profile.following')} value={f.compact(String(stats.following))} />
          <Stat label={t('profile.copiers')} value={f.compact(String(stats.copiers))} />
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="h3">{t('profile.portfolio')}</Text>
            {history.data ? <PnLBadge pct={changePct} locale={f.locale} /> : null}
          </View>
          {history.data === null ? (
            <Text tone="muted">{t('profile.portfolioPrivate')}</Text>
          ) : values.length > 1 ? (
            <Sparkline
              values={values}
              width={600}
              height={120}
              color={changePct.startsWith('-') ? colors.loss : colors.gain}
              fill
            />
          ) : (
            <SkeletonList count={1} />
          )}
          <SegmentedControl
            segments={[
              { value: '1D', label: t('profile.periodDay') },
              { value: '1W', label: t('profile.periodWeek') },
              { value: '1M', label: t('profile.periodMonth') },
              { value: 'ALL', label: t('profile.periodAll') },
            ]}
            value={range}
            onChange={setRange}
          />
        </Card>

        <SegmentedControl
          variant="underline"
          segments={[
            { value: 'trades', label: t('profile.trades') },
            { value: 'theses', label: t('profile.theses') },
            { value: 'holdings', label: t('profile.holdings') },
            { value: 'badges', label: t('profile.badges') },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'trades' ? (
          trades.isLoading ? (
            <SkeletonList count={4} />
          ) : (trades.data?.pages[0]?.items.length ?? 0) === 0 ? (
            <EmptyState title={t('profile.noTrades')} />
          ) : (
            <Card padded={false} className="px-4" testID="profile-trades">
              {trades.data?.pages
                .flatMap((p) => p.items)
                .map((tr) => (
                  <Pressable
                    key={tr.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/asset/[symbol]', params: { symbol: tr.symbol } })
                    }
                    className="min-h-[56px] flex-row items-center justify-between py-2"
                  >
                    <View>
                      <Text weight="semibold">
                        <Text weight="semibold" tone={tr.side === 'buy' ? 'gain' : 'loss'}>
                          {tr.side === 'buy' ? t('feed.bought') : t('feed.sold')}
                        </Text>{' '}
                        {tr.symbol}
                      </Text>
                      <Text variant="micro" tone="muted">
                        {timeAgo(t, tr.createdAt)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text variant="small" numeric>
                        {tr.notional === '0' ? t('feed.private') : f.money(tr.notional)}
                      </Text>
                      <Text variant="micro" tone="muted" numeric>
                        @ {f.price(tr.price)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              {trades.hasNextPage ? (
                <Button
                  label={t('common.more')}
                  variant="ghost"
                  onPress={() => void trades.fetchNextPage()}
                />
              ) : null}
            </Card>
          )
        ) : null}

        {tab === 'theses' ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              {(['all', 'active', 'hit', 'invalidated', 'expired'] as const).map((s) => (
                <Chip
                  key={s}
                  label={s === 'all' ? t('theses.all') : t(`theses.status.${s}`)}
                  selected={thesisFilter === s}
                  onPress={() => setThesisFilter(s)}
                />
              ))}
            </View>
            {theses.isLoading ? (
              <SkeletonList count={3} variant="card" />
            ) : theses.data?.length ? (
              theses.data.map((th) => <ThesisBody key={th.id} item={{ thesis: th }} />)
            ) : (
              <EmptyState title={t('profile.noTheses')} />
            )}
          </View>
        ) : null}

        {tab === 'holdings' ? (
          holdings.isLoading ? (
            <SkeletonList count={4} />
          ) : holdings.data === null ? (
            <EmptyState title={t('profile.holdingsPrivate')} />
          ) : holdings.data?.length ? (
            <Card padded={false} className="px-4">
              {holdings.data.map((h) => (
                <Pressable
                  key={h.asset.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/asset/[symbol]', params: { symbol: h.asset.symbol } })
                  }
                  className="min-h-[56px] flex-row items-center justify-between py-2"
                >
                  <Text weight="semibold">{h.asset.symbol}</Text>
                  <View className="items-end">
                    <Text variant="small" numeric>
                      {own || profile.shareExactAmounts ? f.money(h.valueUsd) : f.qty(h.qty)}
                    </Text>
                    <PnLBadge pct={h.unrealizedPnlPct} locale={f.locale} />
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : (
            <EmptyState title={t('profile.noHoldings')} />
          )
        ) : null}

        {tab === 'badges' ? (
          badges.data?.length ? (
            <View className="flex-row flex-wrap gap-3">
              {badges.data.map((b) => (
                <Card key={b.slug} className="w-[47%] items-center gap-1">
                  <Text variant="h1">{b.badge.icon}</Text>
                  <Text weight="semibold" align="center">
                    {i18n.language === 'id' ? b.badge.nameId : b.badge.nameEn}
                  </Text>
                  <Text variant="micro" tone="muted" align="center">
                    {i18n.language === 'id' ? b.badge.descriptionId : b.badge.descriptionEn}
                  </Text>
                </Card>
              ))}
            </View>
          ) : badges.isLoading ? (
            <SkeletonList count={2} variant="card" />
          ) : (
            <EmptyState title={t('profile.noBadges')} />
          )
        ) : null}
      </View>

      <BottomSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={`@${profile.username}`}
        closeLabel={t('common.close')}
      >
        <View className="gap-2">
          <Text variant="small" weight="semibold" tone="muted">
            {t('profile.reportTitle')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(['spam', 'scam', 'harassment', 'impersonation', 'other'] as const).map((reason) => (
              <Chip
                key={reason}
                label={t(`profile.reportReason.${reason}`)}
                onPress={async () => {
                  await backend.report({ targetType: 'user', targetId: profile.id, reason });
                  toast.show(t('feed.reported'), 'success');
                  setMenu(false);
                }}
              />
            ))}
          </View>
          <Text variant="small" tone="muted" className="mt-3">
            {t('profile.blockConfirm', { username: `@${profile.username}` })}
          </Text>
          <Button
            label={user.isBlocked ? t('profile.unblock') : t('profile.block')}
            variant="danger"
            onPress={async () => {
              if (user.isBlocked) await backend.unblock(profile.id);
              else await backend.block(profile.id);
              if (!user.isBlocked)
                toast.show(t('profile.blocked', { username: `@${profile.username}` }), 'info');
              setMenu(false);
              void qc.invalidateQueries();
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
