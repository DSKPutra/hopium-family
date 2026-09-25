import { CHAIN_META, explorerUrl } from '../../chains';
import { AppError } from '../../errors';
import { fakeTxHash, hashString, mulberry32 } from '../../random';
import type { Balance, Chain, Session, TxResult, UnsignedTx } from '../../types';
import { CHAINS } from '../../types';
import type { LoginMethod, WalletProvider } from '../interfaces';
import { CATALOG, USDC_ID } from './catalog';
import type { MockWorld } from './world';

const SPONSORED: Chain[] = ['solana', 'base', 'arbitrum', 'robinhood'];

export function demoUserIdFor(method: LoginMethod, email?: string): string {
  if (method === 'email' && email)
    return `u_${hashString(email.trim().toLowerCase()).toString(36)}`;
  return `u_${method}_demo`;
}

export function demoAddresses(userId: string): Record<Chain, string> {
  const r = mulberry32(hashString(`wallet:${userId}`));
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let sol = '';
  for (let i = 0; i < 44; i++) sol += alphabet[Math.floor(r() * alphabet.length)];
  let evm = '0x';
  for (let i = 0; i < 40; i++) evm += Math.floor(r() * 16).toString(16);
  return Object.fromEntries(CHAINS.map((c) => [c, CHAIN_META[c].evm ? evm : sol])) as Record<
    Chain,
    string
  >;
}

/** Embedded-wallet mock. Any 6-digit code signs in during demo mode. */
export class MockWallet implements WalletProvider {
  constructor(private world: MockWorld) {}

  async login(method: LoginMethod, payload?: { email?: string; otp?: string }): Promise<Session> {
    await this.world.simulateLatency();
    if (method === 'email') {
      if (!payload?.email) throw new AppError('invalid_input', 'Email is required');
      if (payload.otp !== undefined && !/^\d{6}$/.test(payload.otp))
        throw new AppError('invalid_input', 'Enter the 6-digit code');
    }
    const userId = demoUserIdFor(method, payload?.email);
    this.world.currentUserId = userId;
    return { userId, email: payload?.email ?? null, method, createdAt: new Date().toISOString() };
  }

  async logout(): Promise<void> {
    this.world.currentUserId = null;
  }

  async getAddresses(): Promise<Record<Chain, string>> {
    return demoAddresses(this.world.requireUser());
  }

  async getBalances(): Promise<Balance[]> {
    const userId = this.world.requireUser();
    const wallet = this.world.balances[userId] ?? {};
    return Object.entries(wallet).map(([assetId, qty]) => {
      const entry = CATALOG.find((c) => c.id === assetId);
      return {
        assetId,
        symbol: entry?.symbol ?? assetId.toUpperCase(),
        chain: entry?.chain ?? 'solana',
        qty,
      };
    });
  }

  async signAndSend(tx: UnsignedTx): Promise<TxResult> {
    await this.world.simulateLatency();
    const txHash = fakeTxHash(tx.chain);
    return {
      txHash,
      chain: tx.chain,
      status: 'confirmed',
      gasSponsored: SPONSORED.includes(tx.chain),
      explorerUrl: explorerUrl(tx.chain, txHash),
    };
  }

  async exportWallet(): Promise<void> {
    await this.world.simulateLatency();
  }

  /** New demo accounts start with $10,000 demo USDC plus a few small bags. */
  fundNewAccount(userId: string, extras: { assetId: string; qty: string }[]): void {
    this.world.credit(userId, USDC_ID, '10000');
    for (const e of extras) this.world.credit(userId, e.assetId, e.qty);
  }
}
