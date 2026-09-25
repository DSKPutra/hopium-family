import { add, gte, str, sub } from '../../money';
import type { Decimal, KycStatus, PerpPosition } from '../../types';

export interface LatencyOptions {
  /** [min, max] ms of simulated latency; [0, 0] in tests. */
  latency: [number, number];
  /** Fraction of order executions that fail with a realistic error. */
  failureRate: number;
}

export interface MockWorldSnapshot {
  balances: Record<string, Record<string, Decimal>>;
  positions: PerpPosition[];
  kyc: Record<string, KycStatus>;
  prices: Record<string, { price: Decimal; open24h: Decimal }>;
}

type Listener = () => void;

/**
 * Shared state for the simulated "outside world": on-chain balances, the perps
 * exchange and the KYC vendor. Mock providers read and write it; the demo
 * backend never touches balances directly.
 */
export class MockWorld {
  currentUserId: string | null = null;
  balances: Record<string, Record<string, Decimal>> = {};
  positions: PerpPosition[] = [];
  kyc: Record<string, KycStatus> = {};
  private listeners = new Set<Listener>();

  constructor(readonly options: LatencyOptions) {}

  requireUser(): string {
    if (!this.currentUserId) throw new Error('not_authenticated');
    return this.currentUserId;
  }

  balance(userId: string, assetId: string): Decimal {
    return this.balances[userId]?.[assetId] ?? '0';
  }

  hasBalance(userId: string, assetId: string, amount: Decimal): boolean {
    return gte(this.balance(userId, assetId), amount);
  }

  credit(userId: string, assetId: string, amount: Decimal): void {
    const wallet = (this.balances[userId] ??= {});
    wallet[assetId] = add(wallet[assetId] ?? '0', amount);
    this.emit();
  }

  debit(userId: string, assetId: string, amount: Decimal): void {
    const wallet = (this.balances[userId] ??= {});
    const next = sub(wallet[assetId] ?? '0', amount);
    if (next.startsWith('-')) throw new Error('insufficient_balance');
    if (next === '0') delete wallet[assetId];
    else wallet[assetId] = str(next);
    this.emit();
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const l of this.listeners) l();
  }

  async simulateLatency(rng: () => number = Math.random): Promise<void> {
    const [min, max] = this.options.latency;
    if (max <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, min + rng() * (max - min)));
  }

  exportState(): Omit<MockWorldSnapshot, 'prices'> {
    return { balances: this.balances, positions: this.positions, kyc: this.kyc };
  }

  importState(snapshot: Partial<MockWorldSnapshot>): void {
    this.balances = snapshot.balances ?? {};
    this.positions = snapshot.positions ?? [];
    this.kyc = snapshot.kyc ?? {};
    this.emit();
  }
}
