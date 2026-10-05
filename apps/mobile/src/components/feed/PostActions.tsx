import type { FeedItem } from '@hopium/core';
import { Button, Text, haptics, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { Copy, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useToggleLike } from '@/hooks/queries';
import { useShare } from '@/lib/share';

export function PostActions({ item, onCopy }: { item: FeedItem; onCopy?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const like = useToggleLike();
  const liked = item.likedByMe;
  const shareLink = useShare();
  const share = () =>
    void shareLink(
      t('feed.shareMessage', { username: `@${item.author.username}` }),
      `https://hopium.family/post/${item.post.id}`,
    );
  return (
    <View className="mt-1 flex-row items-center gap-1">
      <Pressable
        testID={`like-${item.post.id}`}
        accessibilityRole="button"
        accessibilityLabel={liked ? t('feed.unlike') : t('feed.like')}
        accessibilityState={{ selected: liked }}
        aria-pressed={liked}
        onPress={() => {
          haptics.light();
          like.mutate({ postId: item.post.id, liked });
        }}
        className="rounded-pill active:bg-surface-2 min-h-[44px] flex-row items-center gap-1.5 px-2.5"
      >
        <Heart
          size={18}
          color={liked ? colors.loss : colors.textMuted}
          fill={liked ? colors.loss : 'transparent'}
        />
        <Text variant="small" tone="muted" numeric>
          {item.post.likeCount}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feed.comments', { count: item.post.commentCount })}
        onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post.id } })}
        className="rounded-pill active:bg-surface-2 min-h-[44px] flex-row items-center gap-1.5 px-2.5"
      >
        <MessageCircle size={18} color={colors.textMuted} />
        <Text variant="small" tone="muted" numeric>
          {item.post.commentCount}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feed.share')}
        onPress={share}
        className="rounded-pill active:bg-surface-2 min-h-[44px] flex-row items-center px-2.5"
      >
        <Share2 size={18} color={colors.textMuted} />
      </Pressable>
      <View className="flex-1" />
      {onCopy ? (
        <Button
          testID={`copy-${item.post.id}`}
          label={t('feed.copy')}
          size="sm"
          variant="secondary"
          icon={<Copy size={14} color={colors.text} />}
          accessibilityLabel={t('feed.copyTrade')}
          onPress={onCopy}
        />
      ) : null}
    </View>
  );
}
