import type { PublicUser } from '@hopium/core';
import { Avatar, Button, Card, TierBadge, Text } from '@hopium/ui';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useToggleFollow } from '@/hooks/queries';
import { useFormat } from '@/lib/format';

export function TraderCard({
  user,
  compact = false,
  onFollowed,
}: {
  user: PublicUser;
  compact?: boolean;
  onFollowed?: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const follow = useToggleFollow();
  const { profile, stats } = user;
  return (
    <Card className={compact ? 'w-[176px] items-center gap-2' : 'gap-3'}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`@${profile.username}`}
        onPress={() =>
          router.push({ pathname: '/user/[username]', params: { username: profile.username } })
        }
        className={compact ? 'items-center gap-2' : 'flex-row items-center gap-3'}
      >
        <Avatar
          id={profile.id}
          name={profile.displayName || profile.username}
          uri={profile.avatarUrl}
          size={compact ? 56 : 48}
        />
        <View className={compact ? 'items-center gap-1' : 'flex-1 gap-1'}>
          <Text weight="semibold" numberOfLines={1}>
            @{profile.username}
          </Text>
          <TierBadge tier={profile.tier} label={t(`tiers.${profile.tier}`)} />
        </View>
      </Pressable>
      <View className={compact ? 'items-center' : 'flex-row gap-4'}>
        <Text
          variant="small"
          numeric
          tone={stats.pnlPct.startsWith('-') ? 'loss' : 'gain'}
          weight="semibold"
        >
          {f.pct(stats.pnlPct, { arrow: true })}
        </Text>
        <Text variant="small" tone="muted" numeric>
          {t('profile.winRate')} {f.pct(stats.winRatePct, { signed: false, decimals: 0 })}
        </Text>
        {!compact ? (
          <Text variant="small" tone="muted" numeric>
            {t('feed.copiers', { count: stats.copiers })}
          </Text>
        ) : null}
      </View>
      <Button
        testID={`follow-${profile.username}`}
        label={user.isFollowing ? t('profile.unfollow') : t('profile.follow')}
        variant={user.isFollowing ? 'secondary' : 'primary'}
        size="sm"
        fullWidth={compact}
        onPress={() =>
          follow.mutate(
            { userId: profile.id, username: profile.username, following: user.isFollowing },
            { onSuccess: () => onFollowed?.() },
          )
        }
      />
    </Card>
  );
}
