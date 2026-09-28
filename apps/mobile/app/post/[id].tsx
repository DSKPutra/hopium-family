import { commentSchema } from '@hopium/core';
import {
  Avatar,
  Button,
  ErrorState,
  IconButton,
  Input,
  Screen,
  SkeletonList,
  Text,
  useTheme,
  useToast,
} from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FeedItemView } from '@/components/feed/FeedItemView';
import { Seo } from '@/components/Seo';
import { useAddComment, useComments, usePost } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';

export default function PostDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const post = usePost(id);
  const comments = useComments(id);
  const add = useAddComment(id);
  const [body, setBody] = useState('');
  const check = commentSchema.safeParse(body);

  const submit = () => {
    if (!check.success) return;
    add.mutate(check.data, {
      onSuccess: () => setBody(''),
      onError: (err) => toast.show(errorMessage(t, err), 'error'),
    });
  };

  return (
    <Screen
      footer={
        <View className="flex-row items-end gap-2">
          <Input
            testID="comment-input"
            className="flex-1"
            placeholder={t('feed.writeComment')}
            accessibilityLabel={t('feed.writeComment')}
            value={body}
            onChangeText={setBody}
            maxLength={500}
            onSubmitEditing={submit}
            error={
              body.length > 0 && !check.success
                ? validationMessage(t, check.error.issues[0]?.message)
                : null
            }
          />
          <Button
            testID="comment-send"
            label={t('feed.send')}
            disabled={!check.success}
            loading={add.isPending}
            onPress={submit}
          />
        </View>
      }
    >
      <Seo title={`${t('feed.commentsTitle')} · hopium.family`} path={`/post/${id}`} />
      <View className="flex-row items-center py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View className="flex-1" />
        <IconButton
          accessibilityLabel={t('feed.report')}
          icon={<Flag size={20} color={colors.textMuted} />}
          onPress={async () => {
            await backend.report({ targetType: 'post', targetId: id, reason: 'spam' });
            toast.show(t('feed.reported'), 'success');
          }}
        />
      </View>
      {post.isLoading ? (
        <SkeletonList count={1} variant="card" />
      ) : post.error || !post.data ? (
        <ErrorState
          title={t('feed.postNotFound')}
          message={post.error ? errorMessage(t, post.error) : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => void post.refetch()}
        />
      ) : (
        <FeedItemView item={post.data} />
      )}
      <Text variant="h3" className="mb-2 mt-5">
        {t('feed.commentsTitle')}
      </Text>
      {comments.isLoading ? (
        <SkeletonList count={3} />
      ) : comments.data?.length ? (
        <View className="gap-4" testID="comments">
          {comments.data.map((c) => (
            <View key={c.id} className="flex-row gap-3">
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  router.push({
                    pathname: '/user/[username]',
                    params: { username: c.author.username },
                  })
                }
              >
                <Avatar
                  id={c.author.id}
                  name={c.author.displayName || c.author.username}
                  uri={c.author.avatarUrl}
                  size={36}
                />
              </Pressable>
              <View className="flex-1 gap-0.5">
                <Text variant="small" weight="semibold">
                  @{c.author.username}{' '}
                  <Text variant="micro" tone="muted">
                    {timeAgo(t, c.createdAt)}
                  </Text>
                </Text>
                <Text>{c.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text tone="muted">{t('feed.noComments')}</Text>
      )}
    </Screen>
  );
}
