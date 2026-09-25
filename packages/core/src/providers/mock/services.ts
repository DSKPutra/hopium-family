import { AppError } from '../../errors';
import { div, gt, max, mul, round, sub } from '../../money';
import { newId } from '../../random';
import type {
  Chain,
  Decimal,
  Fiat,
  KycStatus,
  OnrampQuote,
  OnrampResult,
  PaymentMethod,
} from '../../types';
import type { AnalyticsProvider, KycProvider, OnrampProvider } from '../interfaces';
import { USDC_ID } from './catalog';
import type { MockWorld } from './world';

/** MoonPay/Coinbase-style on-ramp mock: card, Apple Pay and Google Pay. */
export class MockOnramp implements OnrampProvider {
  constructor(
    private world: MockWorld,
    private idrPerUsd: Decimal = '16250',
  ) {}

  async getQuote(p: {
    fiat: Fiat;
    fiatAmount: Decimal;
    asset: string;
    chain: Chain;
  }): Promise<OnrampQuote> {
    await this.world.simulateLatency();
    if (!gt(p.fiatAmount, 0)) throw new AppError('invalid_amount');
    const usd = p.fiat === 'USD' ? p.fiatAmount : div(p.fiatAmount, this.idrPerUsd);
    const feeUsd = max('1.99', mul(usd, '0.0149'));
    const cryptoAmount = round(max('0', sub(usd, feeUsd)), 6, 'down');
    return {
      id: newId('oq_'),
      fiat: p.fiat,
      fiatAmount: p.fiatAmount,
      asset: p.asset,
      chain: p.chain,
      cryptoAmount,
      feeFiat: p.fiat === 'USD' ? round(feeUsd, 2) : round(mul(feeUsd, this.idrPerUsd), 0),
      rate: p.fiat === 'USD' ? '1' : this.idrPerUsd,
      expiresAt: Date.now() + 60_000,
    };
  }

  async startPurchase(q: OnrampQuote, _method: PaymentMethod): Promise<OnrampResult> {
    const userId = this.world.requireUser();
    if (Date.now() > q.expiresAt) throw new AppError('quote_expired');
    await this.world.simulateLatency();
    await this.world.simulateLatency();
    if (!gt(q.cryptoAmount, 0))
      throw new AppError('min_order', 'Amount is below the provider minimum.');
    this.world.credit(userId, q.asset || USDC_ID, q.cryptoAmount);
    return {
      status: 'completed',
      cryptoAmount: q.cryptoAmount,
      asset: q.asset,
      reference: newId('mp_'),
    };
  }
}

/** Sumsub/Persona-style KYC mock that approves after ~3 seconds. */
export class MockKyc implements KycProvider {
  constructor(
    private world: MockWorld,
    private approveAfterMs = 3000,
  ) {}

  async getStatus(): Promise<KycStatus> {
    return this.world.kyc[this.world.requireUser()] ?? 'none';
  }

  async start(): Promise<void> {
    const userId = this.world.requireUser();
    this.world.kyc[userId] = 'pending';
    this.world.emit();
    await this.world.simulateLatency();
    setTimeout(() => {
      if (this.world.kyc[userId] === 'pending') {
        this.world.kyc[userId] = 'approved';
        this.world.emit();
      }
    }, this.approveAfterMs);
  }
}

/** Records analytics calls in memory (PostHog slot in live mode). */
export class MockAnalytics implements AnalyticsProvider {
  readonly events: {
    type: string;
    name: string;
    props?: Record<string, string | number | boolean>;
  }[] = [];
  identify(userId: string): void {
    this.events.push({ type: 'identify', name: userId });
  }
  track(event: string, props?: Record<string, string | number | boolean>): void {
    this.events.push({ type: 'track', name: event, props });
    if (this.events.length > 200) this.events.shift();
  }
  screen(name: string): void {
    this.track(`screen:${name}`);
  }
  reset(): void {
    this.events.length = 0;
  }
}
