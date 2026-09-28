import type {
  AssetClass,
  AssetSort,
  CandleRange,
  FeedItem,
  FeedKind,
  LeaderboardMetric,
  LeaderboardPeriod,
  Page,
  PortfolioRange,
  ThesisStatus,
} from '@hopium/core';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { queryKeys, staleTimes } from '@/lib/queryKeys';
import { useServices } from './useServices';

// ─── session & config ──────────────────────────────────────────────────────
export function useSession() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => backend.getSession(),
    staleTime: Infinity,
  });
}

export function useMe() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => backend.getMe(),
    staleTime: staleTimes.profiles,
  });
}

export function useAppConfig() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => backend.getAppConfig(),
    staleTime: 10 * 60_000,
  });
}

export function useRegionRule() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.region,
    queryFn: () => backend.getRegionRule(),
    staleTime: staleTimes.profiles,
  });
}

export function useKycStatus() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.kyc,
    queryFn: () => backend.getKycStatus(),
    refetchInterval: (q) => (q.state.data === 'pending' ? 1000 : false),
  });
}

// ─── markets ───────────────────────────────────────────────────────────────
export function useAssets(
  q: { class?: AssetClass; sort?: AssetSort; tag?: string; search?: string; limit?: number },
  enabled = true,
) {
  const { market } = useServices();
  return useQuery({
    queryKey: queryKeys.assets(q),
    queryFn: async () => (await market.listAssets(q)).items,
    staleTime: staleTimes.assetLists,
    enabled,
  });
}

export function useAsset(symbolOrId: string | undefined) {
  const { market } = useServices();
  return useQuery({
    queryKey: queryKeys.asset(symbolOrId ?? ''),
    queryFn: () => market.getAsset(symbolOrId as string),
    enabled: !!symbolOrId,
    staleTime: staleTimes.prices,
  });
}

export function useCandles(assetId: string | undefined, range: CandleRange) {
  const { market } = useServices();
  return useQuery({
    queryKey: queryKeys.candles(assetId ?? '', range),
    queryFn: () => market.getCandles(assetId as string, range),
    enabled: !!assetId,
    staleTime: 60_000,
  });
}

// ─── feed & social ─────────────────────────────────────────────────────────
export function useFeed(kind: FeedKind) {
  const { backend } = useServices();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(kind),
    queryFn: ({ pageParam }) => backend.getFeed(kind, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: staleTimes.feed,
  });
}

export function usePost(id: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.post(id ?? ''),
    queryFn: () => backend.getPost(id as string),
    enabled: !!id,
  });
}

export function useComments(postId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.comments(postId ?? ''),
    queryFn: () => backend.getComments(postId as string),
    enabled: !!postId,
  });
}

export function useLegendsBuying() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.legends,
    queryFn: () => backend.getLegendsBuying(),
    staleTime: staleTimes.feed,
  });
}

export function useFollowSuggestions(limit = 10) {
  const { backend } = useServices();
  return useQuery({
    queryKey: [...queryKeys.suggestions, limit],
    queryFn: () => backend.getFollowSuggestions(limit),
    staleTime: staleTimes.profiles,
  });
}

export function useUser(username: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.user(username ?? ''),
    queryFn: () => backend.getUser(username as string),
    enabled: !!username,
    staleTime: staleTimes.profiles,
  });
}

export function useUserTrades(userId: string | undefined) {
  const { backend } = useServices();
  return useInfiniteQuery({
    queryKey: queryKeys.userTrades(userId ?? ''),
    queryFn: ({ pageParam }) => backend.getUserTrades(userId as string, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId,
  });
}

export function useUserTheses(userId: string | undefined, status: ThesisStatus | 'all') {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.userTheses(userId ?? '', status),
    queryFn: () => backend.getUserTheses(userId as string, status),
    enabled: !!userId,
  });
}

export function useUserHoldings(userId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.userHoldings(userId ?? ''),
    queryFn: () => backend.getUserHoldings(userId as string),
    enabled: !!userId,
  });
}

export function useUserBadges(userId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.userBadges(userId ?? ''),
    queryFn: () => backend.getUserBadges(userId as string),
    enabled: !!userId,
  });
}

export function usePortfolioHistory(userId: string | undefined, range: PortfolioRange) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.portfolioHistory(userId ?? '', range),
    queryFn: () => backend.getPortfolioHistory(userId as string, range),
    enabled: !!userId,
  });
}

export function useSearch(query: string) {
  const { backend } = useServices();
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => backend.search(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}

// ─── trading & wallet ──────────────────────────────────────────────────────
export function usePortfolio() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: () => backend.getPortfolio(),
    staleTime: staleTimes.prices,
    refetchInterval: 5000,
  });
}

export function useHolding(assetId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.holding(assetId ?? ''),
    queryFn: () => backend.getHolding(assetId as string),
    enabled: !!assetId,
    refetchInterval: 5000,
  });
}

export function useActivity(kind: string) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.activity(kind),
    queryFn: () => backend.getActivity(kind as never),
  });
}

export function useOrders() {
  const { backend } = useServices();
  return useQuery({ queryKey: queryKeys.orders, queryFn: () => backend.getOrders() });
}

export function useHoldersIFollow(assetId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.holdersIFollow(assetId ?? ''),
    queryFn: () => backend.getAssetHoldersIFollow(assetId as string),
    enabled: !!assetId,
  });
}

export function useAssetTheses(assetId: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.assetTheses(assetId ?? ''),
    queryFn: () => backend.getAssetTheses(assetId as string),
    enabled: !!assetId,
  });
}

export function usePerpMarkets() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.perpMarkets,
    queryFn: () => backend.getPerpMarkets(),
    staleTime: staleTimes.prices,
    refetchInterval: 5000,
  });
}

export function usePerpMarket(id: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.perpMarket(id ?? ''),
    queryFn: () => backend.getPerpMarket(id as string),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function usePositions() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.positions,
    queryFn: () => backend.getPositions(),
    refetchInterval: 2000,
  });
}

export function usePositionHistory() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.positionHistory,
    queryFn: () => backend.getPositionHistory(),
  });
}

export function useAddresses() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => backend.getAddresses(),
    staleTime: Infinity,
  });
}

export function useThesis(id: string | undefined) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.thesis(id ?? ''),
    queryFn: () => backend.getThesis(id as string),
    enabled: !!id,
  });
}

export function useLeaderboard(period: LeaderboardPeriod, metric: LeaderboardMetric) {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.leaderboard(period, metric),
    queryFn: () => backend.getLeaderboard(period, metric),
    staleTime: 60_000,
  });
}

export function useNotifications() {
  const { backend } = useServices();
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => backend.getNotifications() });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.filter((n) => !n.readAt).length ?? 0;
}

export function useNotificationSettings() {
  const { backend } = useServices();
  return useQuery({
    queryKey: queryKeys.notificationSettings,
    queryFn: () => backend.getNotificationSettings(),
  });
}

export function usePriceAlerts() {
  const { backend } = useServices();
  return useQuery({ queryKey: queryKeys.priceAlerts, queryFn: () => backend.getPriceAlerts() });
}

// ─── optimistic mutations ──────────────────────────────────────────────────
type FeedData = InfiniteData<Page<FeedItem>, string | null>;

function patchPostEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  for (const kind of ['following', 'trending', 'theses'] as const) {
    qc.setQueryData<FeedData>(queryKeys.feed(kind), (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((i) => (i.post.id === postId ? patch(i) : i)),
            })),
          }
        : data,
    );
  }
  qc.setQueryData<FeedItem>(queryKeys.post(postId), (item) => (item ? patch(item) : item));
}

export function useToggleLike() {
  const { backend } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      liked ? backend.unlike(postId) : backend.like(postId),
    onMutate: ({ postId, liked }) => {
      patchPostEverywhere(qc, postId, (i) => ({
        ...i,
        likedByMe: !liked,
        post: { ...i.post, likeCount: Math.max(0, i.post.likeCount + (liked ? -1 : 1)) },
      }));
    },
    onError: (_e, { postId, liked }) => {
      patchPostEverywhere(qc, postId, (i) => ({
        ...i,
        likedByMe: liked,
        post: { ...i.post, likeCount: Math.max(0, i.post.likeCount + (liked ? 1 : -1)) },
      }));
    },
  });
}

export function useToggleFollow() {
  const { backend } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      following,
    }: {
      userId: string;
      username?: string;
      following: boolean;
    }) => (following ? backend.unfollow(userId) : backend.follow(userId)),
    onMutate: ({ username, following }) => {
      if (username) {
        qc.setQueryData(
          queryKeys.user(username),
          (u: Awaited<ReturnType<typeof backend.getUser>> | undefined) =>
            u
              ? {
                  ...u,
                  isFollowing: !following,
                  stats: { ...u.stats, followers: u.stats.followers + (following ? -1 : 1) },
                }
              : u,
        );
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: queryKeys.suggestions });
      void qc.invalidateQueries({ queryKey: queryKeys.feed('following') });
    },
  });
}

export function useAddComment(postId: string) {
  const { backend } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => backend.addComment(postId, body),
    onSuccess: (comment) => {
      qc.setQueryData(
        queryKeys.comments(postId),
        (list: Awaited<ReturnType<typeof backend.getComments>> | undefined) => [
          ...(list ?? []),
          comment,
        ],
      );
      patchPostEverywhere(qc, postId, (i) => ({
        ...i,
        post: { ...i.post, commentCount: i.post.commentCount + 1 },
      }));
    },
  });
}
