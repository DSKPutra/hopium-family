import { AppError, ProviderNotConfiguredError } from '../../errors';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export async function getJson<T>(
  fetchImpl: FetchLike,
  url: string,
  init?: Parameters<FetchLike>[1],
): Promise<T> {
  const res = await fetchImpl(url, init);
  if (res.status === 429)
    throw new AppError('rate_limited', 'Too many requests. Please wait a moment.');
  if (!res.ok) throw new AppError('network_busy', `Request failed (${res.status})`);
  return (await res.json()) as T;
}

export function requireEnv(
  provider: string,
  values: Record<string, string | undefined>,
  hint?: string,
): Record<string, string> {
  const missing = Object.entries(values)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new ProviderNotConfiguredError(provider, missing, hint);
  return values as Record<string, string>;
}
