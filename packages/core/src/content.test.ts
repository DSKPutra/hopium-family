import { isValidAddress, truncateAddress } from './chains';
import { isAdult, usernameSchema } from './schemas';

describe('schemas & chains', () => {
  it('validates usernames', () => {
    expect(usernameSchema.safeParse('Moon_Cat').success).toBe(true);
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('bad-name').success).toBe(false);
    expect(usernameSchema.safeParse('admin').success).toBe(false);
  });
  it('checks adulthood conservatively', () => {
    const now = new Date('2026-06-01');
    // Born 2008 could still be 17 in mid-2026; born 2007 is at least 18.
    expect(isAdult(2008, now)).toBe(false);
    expect(isAdult(2007, now)).toBe(true);
  });
  it('validates addresses per chain', () => {
    expect(isValidAddress('solana', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true);
    expect(isValidAddress('base', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(isValidAddress('base', '0xde709f2102306220921060314715629080e2fb77')).toBe(true);
    expect(isValidAddress('ethereum', '0x123')).toBe(false);
    expect(isValidAddress('solana', '0xde709f2102306220921060314715629080e2fb77')).toBe(false);
    expect(truncateAddress('0xde709f2102306220921060314715629080e2fb77')).toBe('0xde70…fb77');
  });
});
