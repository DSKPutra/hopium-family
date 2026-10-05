import {
  add,
  dec,
  div,
  feeRatePct,
  gt,
  isValidDecimal,
  lt,
  mul,
  round,
  spotFeeRate,
  toAppError,
  DEFAULT_MIN_ORDER_USD,
  type SpotOrderResult,
  type Side,
} from '@hopium/core';
import {
  AmountInput,
  AssetLogo,
  BottomSheet,
  Button,
  Chip,
  IconButton,
  PnLBadge,
  RiskBanner,
  SegmentedControl,
  Skeleton,
  SwipeToConfirm,
  Switch,
  Text,
  haptics,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CheckCircle2, ExternalLink, Settings2, XCircle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';

import { useAsset, useHolding, usePortfolio, useRegionRule } from '@/hooks/queries';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useNow } from '@/hooks/useNow';
import { useServices } from '@/hooks/useServices';
import { authenticate } from '@/lib/biometrics';
import { errorMessage } from '@/lib/errors';
import { displaySymbol, useFormat } from '@/lib/format';
import type { OrderRequest } from '@/providers/TradeProvider';
import { useSettings } from '@/stores/settings';
import { QuoteBreakdown } from './QuoteBreakdown';
import { SlippageSettings } from './SlippageSettings';

type Step =
  | { kind: 'form' }
  | { kind: 'success'; result: SpotOrderResult }
  | { kind: 'failure'; message: string };

export function OrderSheet({ request, onClose }: { request: OrderRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const settings = useSettings();
  const now = useNow(1000);

  const [side, setSide] = useState<Side>(request.side);
  const [mode, setMode] = useState<'usd' | 'qty'>('usd');
  const [amount, setAmount] = useState(
    request.amountUsd ?? (request.copyFrom ? settings.lastAmountUsd || '25' : ''),
  );
  const [slippageBps, setSlippageBps] = useState(settings.slippageBps);
  const [showSlippage, setShowSlippage] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [step, setStep] = useState<Step>({ kind: 'form' });

  const assetQ = useAsset(request.assetId);
  const asset = assetQ.data;
  const live = useLivePrice(
    asset?.id,
    asset ? { price: asset.price, change24hPct: asset.change24hPct } : undefined,
  );
  const price = live?.price ?? asset?.price ?? '0';
  const portfolio = usePortfolio();
  const holding = useHolding(asset?.id);
  const region = useRegionRule();

  const assetClass = asset?.class === 'stock_token' ? 'stock_token' : 'crypto';
  const feeRate = spotFeeRate(assetClass);
  const minOrder = DEFAULT_MIN_ORDER_USD[assetClass];
  const cash = portfolio.data?.cashUsd ?? '0';
  const heldQty = holding.data?.qty ?? '0';
  const symbol = asset ? displaySymbol(asset.symbol, asset.tags) : '';
  const blocked = assetClass === 'stock_token' && region.data?.allowStockTokens === false;

  const valid = amount !== '' && isValidDecimal(amount) && gt(amount, 0) && gt(price, 0);
  const amountUsd = valid ? (mode === 'usd' ? amount : round(mul(amount, price), 6)) : '0';
  const qty = valid ? (mode === 'qty' ? amount : round(div(amount, price), 12, 'down')) : '0';

  const validation = useMemo(() => {
    if (!valid) return null;
    if (lt(amountUsd, minOrder))
      return { key: 'min', message: t('order.minOrder', { min: minOrder }) };
    if (side === 'buy' && gt(add(amountUsd, mul(amountUsd, feeRate)), cash))
      return { key: 'insufficient', message: t('order.insufficient') };
    if (side === 'sell' && gt(qty, heldQty))
      return { key: 'holding', message: t('order.insufficientHolding', { symbol }) };
    return null;
  }, [valid, amountUsd, minOrder, side, feeRate, cash, qty, heldQty, symbol, t]);

  const quoteKey = valid ? round(amountUsd, 2) : '';
  const quoteQ = useQuery({
    queryKey: ['quote', request.assetId, side, quoteKey, mode === 'qty' ? qty : '', slippageBps],
    queryFn: () =>
      backend.quoteSpot({
        assetId: request.assetId,
        side,
        amountUsd: side === 'buy' || mode === 'usd' ? amountUsd : undefined,
        qty: side === 'sell' && mode === 'qty' ? qty : undefined,
        slippageBps,
      }),
    enabled: !!asset && valid && !validation && !blocked && step.kind === 'form',
    refetchInterval: 15_000,
    staleTime: 14_000,
    retry: false,
  });
  const quote = quoteQ.data;
  const secondsLeft = quote ? Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)) : 0;

  useEffect(() => {
    if (quote && secondsLeft === 0 && !quoteQ.isFetching) void quoteQ.refetch();
  }, [quote, secondsLeft, quoteQ]);

  const place = useMutation({
    mutationFn: async () => {
      if (!quote) throw new Error('no quote');
      if (settings.biometricForTrades && !(await authenticate(t('order.biometricPrompt'))))
        throw new Error('cancelled');
      return backend.placeSpotOrder(quote, {
        shareToFeed,
        copiedFromTradeId: request.copyFrom?.trade?.id ?? null,
      });
    },
    onSuccess: (result) => {
      haptics.success();
      if (side === 'buy') settings.set({ lastAmountUsd: round(amountUsd, 2), slippageBps });
      setStep({ kind: 'success', result });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'cancelled') return;
      const e = toAppError(err);
      haptics.error();
      if (e.code === 'quote_expired') {
        toast.show(errorMessage(t, err), 'info');
        void quoteQ.refetch();
        return;
      }
      setStep({ kind: 'failure', message: errorMessage(t, err) });
    },
  });

  const setMax = () => {
    if (side === 'buy') {
      setMode('usd');
      setAmount(round(div(cash, add(1, feeRate)), 2, 'down'));
    } else {
      setMode('qty');
      setAmount(round(heldQty, 8, 'down'));
    }
  };

  const title = side === 'buy' ? t('order.titleBuy', { symbol }) : t('order.titleSell', { symbol });
  const copy = request.copyFrom;

  let body: React.ReactNode;
  if (step.kind === 'success') {
    const { result } = step;
    body = (
      <View className="items-center gap-4 py-4" testID="order-success">
        <CheckCircle2 size={56} color={colors.gain} />
        <Text variant="h2" align="center">
          {t('order.filledTitle')}
        </Text>
        {result.isFirstTrade ? (
          <Text align="center" tone="primary" weight="semibold">
            {t('order.firstTrade')}
          </Text>
        ) : null}
        <View className="border-border bg-surface-2 w-full gap-2 rounded-md border p-3">
          <Text variant="small" weight="semibold">
            {t('order.receipt')}
          </Text>
          {result.trade ? (
            <>
              <ReceiptRow
                label={t('order.filledQty')}
                value={`${f.qty(result.trade.qty)} ${symbol}`}
              />
              <ReceiptRow label={t('order.fillPrice')} value={f.price(result.trade.price)} />
              <ReceiptRow label={t('order.fees')} value={f.usd(result.trade.fee)} />
            </>
          ) : null}
          {result.order.txHash ? (
            <ReceiptRow
              label={t('order.txHash')}
              value={`${result.order.txHash.slice(0, 8)}…${result.order.txHash.slice(-6)}`}
            />
          ) : null}
        </View>
        {result.txExplorerUrl ? (
          <Button
            label={t('order.viewExplorer')}
            variant="ghost"
            iconRight={<ExternalLink size={16} color={colors.primary} />}
            onPress={() => void Linking.openURL(result.txExplorerUrl as string)}
          />
        ) : null}
        <Button label={t('common.done')} fullWidth onPress={onClose} testID="order-done" />
      </View>
    );
  } else if (step.kind === 'failure') {
    body = (
      <View className="items-center gap-4 py-4" testID="order-failure">
        <XCircle size={56} color={colors.loss} />
        <Text variant="h3" align="center">
          {t('order.failedTitle')}
        </Text>
        <Text tone="muted" align="center">
          {step.message}
        </Text>
        <Button label={t('order.tryAgain')} fullWidth onPress={() => setStep({ kind: 'form' })} />
      </View>
    );
  } else if (!asset) {
    body = (
      <View className="gap-3 py-6">
        <Skeleton height={48} />
        <Skeleton height={120} />
      </View>
    );
  } else {
    body = (
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <AssetLogo
            symbol={asset.symbol}
            uri={asset.logoUrl}
            size={40}
            shape={asset.class === 'stock_token' ? 'squircle' : 'circle'}
          />
          <View className="flex-1">
            <Text weight="semibold">{symbol}</Text>
            <Text variant="small" tone="muted" numeric>
              {f.price(price)}
            </Text>
          </View>
          <IconButton
            accessibilityLabel={t('order.slippage')}
            icon={<Settings2 size={20} color={showSlippage ? colors.primary : colors.textMuted} />}
            onPress={() => setShowSlippage((v) => !v)}
          />
        </View>

        <SegmentedControl
          segments={[
            { value: 'buy', label: t('order.buy') },
            { value: 'sell', label: t('order.sell') },
          ]}
          value={side}
          onChange={(v) => {
            setSide(v);
            setMode('usd');
          }}
        />

        {copy?.trade ? (
          <View
            className="border-secondary/40 bg-secondary/10 gap-2 rounded-md border p-3"
            testID="copy-info"
          >
            <View className="flex-row justify-between">
              <Text variant="small" tone="muted">
                {t('copy.originalEntry')}
              </Text>
              <Text variant="small" numeric weight="medium">
                {f.price(copy.trade.price)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="small" tone="muted">
                {t('copy.currentPrice')}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text variant="small" numeric weight="medium">
                  {f.price(price)}
                </Text>
                <PnLBadge
                  pct={
                    gt(copy.trade.price, 0)
                      ? round(
                          mul(
                            div(
                              dec(price).minus(dec(copy.trade.price)).toFixed(),
                              copy.trade.price,
                            ),
                            100,
                          ),
                          4,
                        )
                      : '0'
                  }
                  locale={f.locale}
                />
              </View>
            </View>
            <Text variant="small">{t('copy.disclaimer')}</Text>
          </View>
        ) : null}

        {blocked ? (
          <RiskBanner
            tone="danger"
            title={t('region.blockedTitle')}
            message={t('order.regionBlocked')}
          />
        ) : null}
        {asset.class === 'stock_token' ? (
          <RiskBanner tone="info" message={t('asset.stockDisclaimer')} />
        ) : null}
        {asset.tags.includes('meme') ? (
          <RiskBanner
            tone="warning"
            title={t('discover.highVolatility')}
            message={t('asset.memeRisk')}
          />
        ) : null}
        {showSlippage ? <SlippageSettings value={slippageBps} onChange={setSlippageBps} /> : null}

        <AmountInput
          testID="order-amount"
          value={amount}
          onChange={setAmount}
          unitLabel={mode === 'usd' ? '$' : asset.symbol}
          unitPosition={mode === 'usd' ? 'prefix' : 'suffix'}
          secondary={
            valid
              ? mode === 'usd'
                ? `≈ ${f.qty(qty)} ${asset.symbol}`
                : `≈ ${f.usd(amountUsd)}`
              : side === 'buy'
                ? t('order.available', { amount: f.usd(cash) })
                : t('order.holding', { amount: `${f.qty(heldQty)} ${asset.symbol}` })
          }
          onToggleUnit={() => {
            if (valid) setAmount(mode === 'usd' ? round(qty, 8, 'down') : round(amountUsd, 2));
            setMode((m) => (m === 'usd' ? 'qty' : 'usd'));
          }}
          toggleLabel={t('order.toggleUnits')}
          deleteLabel={t('common.deleteKey')}
          accessibilityLabel={t('order.amount')}
          maxDecimals={mode === 'usd' ? 2 : 8}
          error={!!validation}
        />

        <View className="flex-row flex-wrap justify-center gap-2">
          {['10', '25', '50', '100'].map((v) => (
            <Chip
              key={v}
              testID={`chip-${v}`}
              label={`$${v}`}
              selected={mode === 'usd' && amount === v}
              onPress={() => {
                setMode('usd');
                setAmount(v);
              }}
            />
          ))}
          <Chip label={t('common.max')} onPress={setMax} testID="chip-max" />
        </View>

        {validation ? (
          <View className="gap-2" accessibilityRole="alert">
            <Text variant="small" tone="loss" align="center" testID="order-validation">
              {validation.message}
            </Text>
            {validation.key === 'insufficient' ? (
              <Button
                label={t('order.addFunds')}
                variant="secondary"
                size="sm"
                onPress={() => {
                  onClose();
                  router.push('/wallet/deposit');
                }}
              />
            ) : null}
          </View>
        ) : null}

        {side === 'sell' && !gt(heldQty, 0) && !holding.isLoading ? (
          <Text variant="small" tone="muted" align="center">
            {t('order.noHolding', { symbol })}
          </Text>
        ) : null}

        {quote && !validation ? (
          <QuoteBreakdown
            quote={quote}
            tags={asset.tags}
            refreshLabel={
              quoteQ.isFetching
                ? t('order.refreshing')
                : t('order.refreshIn', { seconds: secondsLeft })
            }
          />
        ) : quoteQ.isFetching ? (
          <Skeleton height={150} />
        ) : quoteQ.error ? (
          <Text variant="small" tone="loss" align="center">
            {errorMessage(t, quoteQ.error)}
          </Text>
        ) : null}

        <Switch
          label={t('order.shareToFeed')}
          description={t('order.shareToFeedHint')}
          value={shareToFeed}
          onValueChange={setShareToFeed}
          testID="share-toggle"
        />

        <SwipeToConfirm
          testID="order-confirm"
          label={
            Platform.OS === 'web'
              ? side === 'buy'
                ? t('order.confirmBuy', { symbol })
                : t('order.confirmSell', { symbol })
              : side === 'buy'
                ? t('order.swipeToBuy')
                : t('order.swipeToSell')
          }
          tone={side === 'buy' ? 'gain' : 'loss'}
          disabled={!quote || !!validation || blocked || quoteQ.isFetching}
          loading={place.isPending}
          onConfirm={() => place.mutate()}
        />
        <Text variant="micro" tone="muted" align="center">
          {t('order.platformFee', { pct: feeRatePct(feeRate) })}
        </Text>
      </View>
    );
  }

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={copy ? t('copy.title', { username: `@${copy.author.username}` }) : title}
      closeLabel={t('common.close')}
      scrollable
      testID="order-sheet"
    >
      {body}
    </BottomSheet>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="small" numeric weight="medium">
        {value}
      </Text>
    </View>
  );
}
