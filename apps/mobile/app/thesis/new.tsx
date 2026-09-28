import {
  THESIS_BODY_MAX,
  THESIS_TIMEFRAMES,
  thesisSchema,
  timeframeEnd,
  validateThesisPrices,
  type Asset,
  type ThesisDirection,
  type ThesisTimeframe,
} from '@hopium/core';
import {
  AssetLogo,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Screen,
  SegmentedControl,
  Text,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ThesisBody } from '@/components/feed/FeedItemView';
import { Seo } from '@/components/Seo';
import { useAsset, useAssets } from '@/hooks/queries';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';
import { displaySymbol, useFormat } from '@/lib/format';

export default function NewThesis() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const f = useFormat();
  const qc = useQueryClient();
  const { backend } = useServices();
  const params = useLocalSearchParams<{ asset?: string }>();
  const [assetId, setAssetId] = useState(params.asset ?? '');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<ThesisDirection>('long');
  const [target, setTarget] = useState('');
  const [invalidation, setInvalidation] = useState('');
  const [timeframe, setTimeframe] = useState<ThesisTimeframe>('1w');
  const [customDate, setCustomDate] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const asset = useAsset(assetId || undefined).data;
  const live = useLivePrice(
    asset?.id,
    asset ? { price: asset.price, change24hPct: asset.change24hPct } : undefined,
  );
  const entry = live?.price ?? asset?.price ?? '0';
  const results = useAssets({ search: query, limit: 8 }, query.length > 0);
  const popular = useAssets({ sort: 'trending', limit: 8 }, !assetId && !query);

  const end =
    timeframe === 'custom'
      ? customDate && !Number.isNaN(Date.parse(`${customDate}T23:59:59Z`))
        ? new Date(`${customDate}T23:59:59Z`).toISOString()
        : ''
      : timeframeEnd(timeframe);
  const priceErrors =
    asset && target && invalidation
      ? validateThesisPrices(direction, entry, target, invalidation)
      : [];
  const parsed = thesisSchema.safeParse({
    assetId,
    direction,
    targetPrice: target,
    invalidationPrice: invalidation,
    timeframeEnd: end,
    body,
    imageUrl: image,
  });
  const issue = (path: string) =>
    parsed.success ? null : parsed.error.issues.find((i) => i.path[0] === path)?.message;
  const canPreview = parsed.success && priceErrors.length === 0;

  const draftThesis = asset
    ? {
        id: 'draft',
        authorId: 'me',
        assetId: asset.id,
        symbol: asset.symbol,
        direction,
        entryPrice: entry,
        targetPrice: target || entry,
        invalidationPrice: invalidation || entry,
        timeframeEnd: end || new Date().toISOString(),
        body,
        imageUrl: image,
        status: 'active' as const,
        resolvedAt: null,
        maxFavorablePct: '0',
        createdAt: new Date().toISOString(),
      }
    : null;

  const publish = async () => {
    if (!parsed.success) return;
    setBusy(true);
    try {
      const thesis = await backend.createThesis(parsed.data);
      toast.show(t('theses.published'), 'success');
      await qc.invalidateQueries({ queryKey: ['feed'] });
      router.replace({ pathname: '/thesis/[id]', params: { id: thesis.id } });
    } catch (err) {
      toast.show(errorMessage(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const pickAsset = (a: Asset) => {
    setAssetId(a.id);
    setQuery('');
    setTarget('');
    setInvalidation('');
  };

  return (
    <Screen
      footer={
        preview ? (
          <View className="flex-row gap-3">
            <Button
              label={t('theses.editDraft')}
              variant="secondary"
              className="flex-1"
              onPress={() => setPreview(false)}
            />
            <Button
              testID="thesis-publish"
              label={t('theses.publish')}
              className="flex-1"
              loading={busy}
              onPress={() => void publish()}
            />
          </View>
        ) : (
          <Button
            testID="thesis-preview"
            label={t('theses.preview')}
            fullWidth
            disabled={!canPreview}
            onPress={() => setPreview(true)}
          />
        )
      }
    >
      <Seo title={`${t('theses.newTitle')} · hopium.family`} path="/thesis/new" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="h2">{t('theses.newTitle')}</Text>
      </View>

      {preview && draftThesis ? (
        <View className="gap-3">
          <ThesisBody item={{ thesis: draftThesis }} />
          <Card>
            <Text>{body}</Text>
            {image ? (
              <Image
                source={{ uri: image }}
                style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 12 }}
                contentFit="cover"
              />
            ) : null}
          </Card>
        </View>
      ) : (
        <View className="gap-4">
          <View className="gap-2">
            <Text variant="small" weight="medium" tone="muted">
              {t('theses.asset')}
            </Text>
            {asset ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('theses.chooseAsset')}
                onPress={() => setAssetId('')}
                className="border-border bg-surface flex-row items-center gap-3 rounded-md border p-3"
              >
                <AssetLogo
                  symbol={asset.symbol}
                  size={36}
                  shape={asset.class === 'stock_token' ? 'squircle' : 'circle'}
                />
                <View className="flex-1">
                  <Text weight="semibold">{displaySymbol(asset.symbol, asset.tags)}</Text>
                  <Text variant="small" tone="muted" numeric>
                    {t('theses.entry')}: {f.price(entry)}
                  </Text>
                </View>
                <Text variant="small" tone="primary">
                  {t('common.edit')}
                </Text>
              </Pressable>
            ) : (
              <>
                <Input
                  testID="thesis-asset-search"
                  placeholder={t('search.placeholder')}
                  value={query}
                  onChangeText={setQuery}
                  left={<Search size={18} color={colors.textMuted} />}
                  accessibilityLabel={t('theses.chooseAsset')}
                />
                <View className="flex-row flex-wrap gap-2">
                  {(query ? results.data : popular.data)?.map((a) => (
                    <Chip
                      key={a.id}
                      testID={`thesis-asset-${a.symbol}`}
                      label={displaySymbol(a.symbol, a.tags)}
                      onPress={() => pickAsset(a)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <SegmentedControl
            segments={[
              { value: 'long', label: `▲ ${t('theses.long')}` },
              { value: 'short', label: `▼ ${t('theses.short')}` },
            ]}
            value={direction}
            onChange={setDirection}
          />

          <View className="flex-row gap-3">
            <Input
              testID="thesis-target"
              className="flex-1"
              label={t('theses.target')}
              value={target}
              onChangeText={(v) => setTarget(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              keyboardType="decimal-pad"
              numeric
              error={
                priceErrors.includes('target_wrong_side')
                  ? t('validation.thesis.target_wrong_side')
                  : null
              }
            />
            <Input
              testID="thesis-invalidation"
              className="flex-1"
              label={t('theses.invalidation')}
              value={invalidation}
              onChangeText={(v) => setInvalidation(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              keyboardType="decimal-pad"
              numeric
              error={
                priceErrors.includes('invalidation_wrong_side')
                  ? t('validation.thesis.invalidation_wrong_side')
                  : null
              }
            />
          </View>

          <View className="gap-2">
            <Text variant="small" weight="medium" tone="muted">
              {t('theses.timeframe')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[...THESIS_TIMEFRAMES, 'custom' as const].map((tf) => (
                <Chip
                  key={tf}
                  label={t(`theses.tf${tf === 'custom' ? 'Custom' : tf}` as never)}
                  selected={timeframe === tf}
                  onPress={() => setTimeframe(tf)}
                />
              ))}
            </View>
            {timeframe === 'custom' ? (
              <Input
                label={t('theses.customDate')}
                value={customDate}
                onChangeText={setCustomDate}
                placeholder="2026-12-31"
                error={customDate ? validationMessage(t, issue('timeframeEnd') ?? undefined) : null}
              />
            ) : null}
          </View>

          <Input
            testID="thesis-body"
            label={t('theses.body')}
            value={body}
            onChangeText={setBody}
            placeholder={t('theses.bodyPlaceholder')}
            multiline
            maxLength={THESIS_BODY_MAX}
            style={{ minHeight: 140, textAlignVertical: 'top' }}
            helper={t('theses.bodyCount', { count: body.length })}
            error={
              body.length > 0 && body.trim().length < 10
                ? validationMessage(t, issue('body') ?? undefined)
                : null
            }
          />

          <View className="flex-row items-center gap-3">
            <Button
              label={image ? t('theses.removeImage') : t('theses.addImage')}
              variant="outline"
              size="sm"
              onPress={async () => {
                if (image) {
                  setImage(null);
                  return;
                }
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 0.7,
                });
                if (!res.canceled && res.assets[0]) setImage(res.assets[0].uri);
              }}
            />
            {image ? (
              <Image source={{ uri: image }} style={{ width: 56, height: 56, borderRadius: 8 }} />
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}
