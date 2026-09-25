import type { Providers } from '../interfaces';
import { MockMarketData } from './marketData';
import { MockPerps } from './perps';
import { MockAnalytics, MockKyc, MockOnramp } from './services';
import { MockStockTokens, MockSwap } from './trading';
import { MockWallet } from './wallet';
import { MockWorld, type LatencyOptions } from './world';

export * from './catalog';
export * from './failures';
export { MockMarketData } from './marketData';
export { MockPerps } from './perps';
export { MockAnalytics, MockKyc, MockOnramp } from './services';
export { MockStockTokens, MockSwap } from './trading';
export { demoAddresses, demoUserIdFor, MockWallet } from './wallet';
export { MockWorld, type LatencyOptions, type MockWorldSnapshot } from './world';

export interface MockProviders extends Providers {
  world: MockWorld;
  wallet: MockWallet;
  marketData: MockMarketData;
  perps: MockPerps;
  kyc: MockKyc;
  analytics: MockAnalytics;
}

export interface CreateMockProvidersOptions extends Partial<LatencyOptions> {
  seed?: number;
  tickMs?: number;
  kycApproveAfterMs?: number;
}

/** All mock providers wired to one shared simulated world. */
export function createMockProviders(opts: CreateMockProvidersOptions = {}): MockProviders {
  const seed = opts.seed ?? 20260924;
  const world = new MockWorld({
    latency: opts.latency ?? [150, 600],
    failureRate: opts.failureRate ?? 0.03,
  });
  const marketData = new MockMarketData(world, { seed, tickMs: opts.tickMs });
  return {
    world,
    wallet: new MockWallet(world),
    marketData,
    swap: new MockSwap(world, marketData),
    stockTokens: new MockStockTokens(world, marketData),
    perps: new MockPerps(world, marketData, seed),
    onramp: new MockOnramp(world),
    kyc: new MockKyc(world, opts.kycApproveAfterMs),
    analytics: new MockAnalytics(),
  };
}
