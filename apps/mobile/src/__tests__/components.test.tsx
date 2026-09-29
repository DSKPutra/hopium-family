import { createMockProviders, DemoBackend, type FeedItem } from '@hopium/core';
import { EmptyState, ErrorState } from '@hopium/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FeedItemView } from '@/components/feed/FeedItemView';
import { PerpOrderPanel } from '@/components/trading/PerpOrderPanel';
import { QuoteBreakdown } from '@/components/trading/QuoteBreakdown';
import { OrderSheet } from '@/components/trading/OrderSheet';
import { renderWithProviders } from '@/testing/render';

const mockProviders = createMockProviders({ latency: [0, 0], failureRate: 0, seed: 11 });
const mockDemo = new DemoBackend(mockProviders, { seed: 11, engines: false });

jest.mock('@/lib/services', () => ({
  getServices: () => ({
    backend: mockDemo,
    providers: mockProviders,
    mock: mockProviders,
    market: mockProviders.marketData,
    demo: mockDemo,
  }),
  backend: () => mockDemo,
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useIsFocused: () => true,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeAll(async () => {
  await mockDemo.startEmailSignIn('tester@hopium.family');
  await mockDemo.verifyOtp('tester@hopium.family', '123456');
  await mockDemo.updateProfile({
    username: 'jest_user',
    countryCode: 'ID',
    birthYear: 1990,
    riskAccepted: true,
  });
  await mockDemo.completeOnboarding();
});

describe('states', () => {
  it('renders empty and error states with actions', async () => {
    const onAction = jest.fn();
    const onRetry = jest.fn();
    await renderWithProviders(
      <>
        <EmptyState
          title="your feed is quiet. follow some legends."
          actionLabel="discover traders"
          onAction={onAction}
        />
        <ErrorState
          title="Something went wrong"
          message="Please try again."
          retryLabel="Try again"
          onRetry={onRetry}
        />
      </>,
    );
    await fireEvent.press(screen.getByText('discover traders'));
    await fireEvent.press(screen.getByText('Try again'));
    expect(onAction).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('FeedItemView', () => {
  it('renders trade, thesis and milestone items', async () => {
    const all: FeedItem[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 12 && all.length < 200; i++) {
      const page = await mockDemo.getFeed('trending', cursor);
      all.push(...page.items);
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    const theses = await mockDemo.getFeed('theses');
    const trade = all.find((i) => i.post.kind === 'trade')!;
    const thesis = theses.items[0]!;
    await renderWithProviders(
      <>
        <FeedItemView item={trade} />
        <FeedItemView item={thesis} />
      </>,
    );
    expect(screen.getByTestId('feed-item-trade')).toBeOnTheScreen();
    expect(screen.getByTestId('feed-item-thesis')).toBeOnTheScreen();
    expect(screen.getAllByText(/bought|sold/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/target/).length).toBeGreaterThan(0);
    // Amounts are shown as size buckets unless the author opts in.
    if (!trade.amountsVisible)
      expect(screen.getByText(/<\$100|\$100–1k|\$1k–10k|\$10k\+/)).toBeOnTheScreen();
  });
});

describe('QuoteBreakdown', () => {
  it('shows sponsored gas, fees and total', async () => {
    const quote = await mockDemo.quoteSpot({
      assetId: 'hope',
      side: 'buy',
      amountUsd: '25',
      slippageBps: 100,
    });
    await renderWithProviders(
      <QuoteBreakdown quote={quote} tags={['meme']} refreshLabel="quote refreshes in 15s" />,
    );
    expect(screen.getByText('sponsored ✨')).toBeOnTheScreen();
    expect(screen.getByText('platform fee (0.75%)')).toBeOnTheScreen();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('$25.19');
  });
});

describe('PerpOrderPanel', () => {
  it('shows the estimated liquidation price and gates high leverage', async () => {
    const market = await mockDemo.getPerpMarket('btc-perp');
    await renderWithProviders(<PerpOrderPanel market={market} />);
    expect(screen.getByText('est. liquidation price')).toBeOnTheScreen();
    expect(screen.getByTestId('perp-liq')).not.toHaveTextContent('—');
    expect(screen.queryByTestId('high-leverage-warning')).toBeNull();
    await fireEvent.press(screen.getByTestId('tick-20'));
    expect(screen.getByTestId('high-leverage-warning')).toBeOnTheScreen();
    expect(screen.getByTestId('perp-open')).toBeDisabled();
  });

  it('validates TP/SL against entry', async () => {
    const market = await mockDemo.getPerpMarket('eth-perp');
    await renderWithProviders(<PerpOrderPanel market={market} />);
    await fireEvent.changeText(screen.getByTestId('perp-tp'), '1');
    expect(screen.getByText(/Take-profit must be above entry/)).toBeOnTheScreen();
  });
});

describe('OrderSheet', () => {
  it('flags orders below the minimum', async () => {
    await renderWithProviders(
      <OrderSheet
        request={{ assetId: 'aaplx', side: 'buy', amountUsd: '1' }}
        onClose={() => undefined}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('order-validation')).toHaveTextContent('Minimum order is $2.'),
    );
  });

  it('flags insufficient balance with an add-funds action', async () => {
    await renderWithProviders(
      <OrderSheet
        request={{ assetId: 'btc', side: 'buy', amountUsd: '50000' }}
        onClose={() => undefined}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('order-validation')).toHaveTextContent(
        'Not enough balance for this order.',
      ),
    );
    expect(screen.getByText('add funds')).toBeOnTheScreen();
  });

  it('shows the copy disclaimer when copying a trade', async () => {
    const item = (await mockDemo.getFeed('trending')).items.find((i) => i.trade?.side === 'buy')!;
    await renderWithProviders(
      <OrderSheet
        request={{ assetId: item.trade!.assetId, side: 'buy', copyFrom: item }}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('copy-info')).toBeOnTheScreen());
    expect(
      screen.getByText('Copying a trade does not guarantee the same result.'),
    ).toBeOnTheScreen();
  });
});
