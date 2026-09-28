import type { AssetClass } from '@hopium/core';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Screen,
  SkeletonList,
  Text,
  useTheme,
} from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AssetRow } from '@/components/AssetRow';
import { ThesisBody } from '@/components/feed/FeedItemView';
import { Seo } from '@/components/Seo';
import { useAssets, usePerpMarkets, useSearch } from '@/hooks/queries';
import { useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

function useDebounced(value: string, ms = 250): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4 gap-1">
      <Text
        variant="small"
        weight="semibold"
        tone="muted"
        style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        {title}
      </Text>
      <Card padded={false} className="px-4">
        {children}
      </Card>
    </View>
  );
}

export default function Search() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const params = useLocalSearchParams<{ scope?: AssetClass; q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const q = useDebounced(query);
  const recent = useSettings((s) => s.recentSearches);
  const addRecent = useSettings((s) => s.addRecentSearch);
  const setSettings = useSettings((s) => s.set);
  const scope = params.scope;
  const crypto = useAssets(
    { search: q, class: 'crypto', limit: 8 },
    (!!q || scope === 'crypto') && scope !== 'stock_token',
  );
  const stocks = useAssets(
    { search: q, class: 'stock_token', limit: 8 },
    (!!q || scope === 'stock_token') && scope !== 'crypto',
  );
  const perps = usePerpMarkets();
  const social = useSearch(scope ? '' : q);
  const perpMatches =
    q && !scope
      ? (perps.data ?? [])
          .filter((m) => m.symbol.toLowerCase().includes(q.toLowerCase().replace(/^\$/, '')))
          .slice(0, 5)
      : [];
  const anything =
    (crypto.data?.length ?? 0) +
      (stocks.data?.length ?? 0) +
      perpMatches.length +
      (social.data?.people.length ?? 0) +
      (social.data?.theses.length ?? 0) >
    0;
  const loading = crypto.isFetching || stocks.isFetching || social.isFetching;

  return (
    <Screen>
      <Seo title={`${t('nav.search')} · hopium.family`} path="/search" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Input
          testID="search-input"
          className="flex-1"
          autoFocus
          placeholder={t('search.placeholder')}
          accessibilityLabel={t('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => addRecent(query)}
          left={<SearchIcon size={18} color={colors.textMuted} />}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      {!q && !scope ? (
        recent.length ? (
          <View className="mt-2 gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="small" weight="semibold" tone="muted">
                {t('search.recent')}
              </Text>
              <Button
                label={t('search.clearRecent')}
                size="sm"
                variant="ghost"
                onPress={() => setSettings({ recentSearches: [] })}
              />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {recent.map((r) => (
                <Button
                  key={r}
                  label={r}
                  size="sm"
                  variant="secondary"
                  onPress={() => setQuery(r)}
                />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState
            title={t('search.hint')}
            icon={<SearchIcon size={32} color={colors.textMuted} />}
          />
        )
      ) : loading && !anything ? (
        <SkeletonList count={6} />
      ) : !anything && q ? (
        <EmptyState title={t('search.noResults', { query: q })} body={t('search.hint')} />
      ) : (
        <View>
          {crypto.data?.length ? (
            <Section title={t('search.assets')}>
              {crypto.data.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  showSpark={false}
                  onPress={() => {
                    addRecent(query || a.symbol);
                    router.push({ pathname: '/asset/[symbol]', params: { symbol: a.symbol } });
                  }}
                />
              ))}
            </Section>
          ) : null}
          {stocks.data?.length ? (
            <Section title={t('search.stockTokens')}>
              {stocks.data.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  showSpark={false}
                  onPress={() => {
                    addRecent(query || a.symbol);
                    router.push({ pathname: '/asset/[symbol]', params: { symbol: a.symbol } });
                  }}
                />
              ))}
            </Section>
          ) : null}
          {perpMatches.length ? (
            <Section title={t('search.perps')}>
              {perpMatches.map((m) => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/perps/[market]', params: { market: m.id } })
                  }
                  className="min-h-[52px] flex-row items-center justify-between py-2"
                >
                  <Text weight="semibold">{m.symbol}</Text>
                  <Text numeric>{f.price(m.markPrice)}</Text>
                </Pressable>
              ))}
            </Section>
          ) : null}
          {social.data?.people.length ? (
            <Section title={t('search.people')}>
              {social.data.people.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => {
                    addRecent(query);
                    router.push({ pathname: '/user/[username]', params: { username: p.username } });
                  }}
                  className="min-h-[56px] flex-row items-center gap-3 py-2"
                >
                  <Avatar
                    id={p.id}
                    name={p.displayName || p.username}
                    uri={p.avatarUrl}
                    size={36}
                  />
                  <View>
                    <Text weight="semibold">@{p.username}</Text>
                    <Text variant="small" tone="muted">
                      {p.displayName}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Section>
          ) : null}
          {social.data?.theses.length ? (
            <View className="mt-4 gap-2">
              <Text
                variant="small"
                weight="semibold"
                tone="muted"
                style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                {t('search.theses')}
              </Text>
              {social.data.theses.map(({ thesis }) => (
                <ThesisBody key={thesis.id} item={{ thesis }} />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
