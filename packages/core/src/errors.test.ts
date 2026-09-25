import { AppError, ProviderNotConfiguredError, toAppError } from './errors';

describe('errors', () => {
  it('wraps unknown errors', () => {
    expect(toAppError(new AppError('min_order')).code).toBe('min_order');
    expect(toAppError(new Error('boom')).message).toBe('boom');
    expect(toAppError('x').code).toBe('unknown');
  });
  it('explains missing provider configuration', () => {
    const e = new ProviderNotConfiguredError(
      'Privy wallet',
      ['EXPO_PUBLIC_WALLET_APP_ID'],
      'create an app',
    );
    expect(e.code).toBe('provider_not_configured');
    expect(e.message).toContain('EXPO_PUBLIC_WALLET_APP_ID');
    expect(e.missing).toEqual(['EXPO_PUBLIC_WALLET_APP_ID']);
  });
});
