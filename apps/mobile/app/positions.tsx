import { Card, IconButton, Screen, SegmentedControl, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { QueryState } from '@/components/QueryState';
import { Seo } from '@/components/Seo';
import { PositionRow } from '@/components/trading/PositionRow';
import { usePositionHistory, usePositions } from '@/hooks/queries';
import { timeAgo, useFormat } from '@/lib/format';

export default function Positions() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const open = usePositions();
  const history = usePositionHistory();
  return (
    <Screen>
      <Seo title={`${t('nav.positions')} · hopium.family`} path="/positions" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/trade'))}
        />
        <Text variant="h2">{t('nav.positions')}</Text>
      </View>
      <SegmentedControl
        className="mb-3"
        segments={[
          { value: 'open', label: t('nav.openPositions') },
          { value: 'history', label: t('perps.history') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'open' ? (
        <QueryState
          query={open}
          isEmpty={(d) => d.length === 0}
          empty={{
            title: t('trade.noPositions'),
            actionLabel: t('trade.openPerp'),
            onAction: () =>
              router.push({ pathname: '/perps/[market]', params: { market: 'btc-perp' } }),
          }}
        >
          {(list) => (
            <View className="gap-3">
              {list.map((p) => (
                <PositionRow key={p.id} position={p} showMarketLink />
              ))}
            </View>
          )}
        </QueryState>
      ) : (
        <QueryState
          query={history}
          isEmpty={(d) => d.length === 0}
          empty={{ title: t('trade.noPositions') }}
        >
          {(list) => (
            <Card padded={false} className="px-4">
              {list.map((p) => (
                <View
                  key={p.id}
                  className="min-h-[60px] flex-row items-center justify-between py-2"
                >
                  <View>
                    <Text weight="semibold">
                      {p.symbol} · {p.side} {p.leverage}×
                    </Text>
                    <Text variant="micro" tone={p.status === 'liquidated' ? 'loss' : 'muted'}>
                      {p.status === 'liquidated' ? t('perps.liquidated') : t('perps.closed')} ·{' '}
                      {p.closedAt ? timeAgo(t, p.closedAt) : ''}
                    </Text>
                  </View>
                  <Text
                    numeric
                    weight="semibold"
                    tone={p.realizedPnl.startsWith('-') ? 'loss' : 'gain'}
                  >
                    {p.realizedPnl.startsWith('-') ? '▼ ' : '▲ '}
                    {f.money(p.realizedPnl, { signed: true })}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </QueryState>
      )}
    </Screen>
  );
}
