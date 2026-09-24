import { parseAppMode, resolveProviderImpl } from './config';

describe('parseAppMode', () => {
  it('defaults to demo', () => {
    expect(parseAppMode(undefined)).toBe('demo');
    expect(parseAppMode('')).toBe('demo');
    expect(parseAppMode('production')).toBe('demo');
  });
  it('accepts live case-insensitively', () => {
    expect(parseAppMode(' LIVE ')).toBe('live');
  });
});

describe('resolveProviderImpl', () => {
  it('forces mock in demo mode', () => {
    expect(resolveProviderImpl('demo', 'privy')).toBe('mock');
  });
  it('uses the flag in live mode, falling back to mock', () => {
    expect(resolveProviderImpl('live', 'Privy')).toBe('privy');
    expect(resolveProviderImpl('live', undefined)).toBe('mock');
  });
});
