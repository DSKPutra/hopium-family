import type { Chain } from './types';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const CHAIN_META: Record<Chain, { name: string; explorer: string; evm: boolean }> = {
  solana: { name: 'Solana', explorer: 'https://solscan.io/tx/', evm: false },
  base: { name: 'Base', explorer: 'https://basescan.org/tx/', evm: true },
  ethereum: { name: 'Ethereum', explorer: 'https://etherscan.io/tx/', evm: true },
  arbitrum: { name: 'Arbitrum', explorer: 'https://arbiscan.io/tx/', evm: true },
  robinhood: { name: 'Robinhood Chain', explorer: 'https://explorer.robinhood.com/tx/', evm: true },
};

export const explorerUrl = (chain: Chain, txHash: string): string =>
  `${CHAIN_META[chain].explorer}${txHash}`;

/** Format check (and EIP-55 checksum shape) for a withdrawal address. */
export function isValidAddress(chain: Chain, address: string): boolean {
  const a = address.trim();
  if (CHAIN_META[chain].evm) {
    if (!EVM_ADDRESS.test(a)) return false;
    const body = a.slice(2);
    // All-lower or all-upper are valid unchecksummed; mixed case must look checksummed.
    return (
      body === body.toLowerCase() ||
      body === body.toUpperCase() ||
      (/[a-f]/.test(body) && /[A-F]/.test(body))
    );
  }
  return SOLANA_ADDRESS.test(a);
}

export const truncateAddress = (address: string, head = 6, tail = 4): string =>
  address.length <= head + tail + 1 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
