import { AppError, type AppErrorCode } from '../../errors';

const FAILURES: { code: AppErrorCode; message: string }[] = [
  { code: 'slippage_exceeded', message: 'Price moved more than your slippage setting.' },
  { code: 'network_busy', message: 'The network is busy. Please try again.' },
  { code: 'insufficient_balance', message: 'Not enough balance for this order.' },
];

/** Randomly fail `rate` of executions so error states get exercised in demo mode. */
export function maybeFail(rate: number, rng: () => number = Math.random): void {
  if (rate <= 0 || rng() >= rate) return;
  const failure = FAILURES[Math.floor(rng() * FAILURES.length)] ?? FAILURES[1]!;
  throw new AppError(failure.code, failure.message);
}
