import { applyKey } from './components/NumericKeypad';
import { sparkPath } from './components/Sparkline';
import { gradientFor, initialsOf } from './components/generated';
import { cn } from './cn';

describe('keypad', () => {
  it('builds decimal strings safely', () => {
    expect(applyKey('', '5')).toBe('5');
    expect(applyKey('0', '5')).toBe('5');
    expect(applyKey('', '.')).toBe('0.');
    expect(applyKey('1.', '.')).toBe('1.');
    expect(applyKey('1.23', '4', 2)).toBe('1.23');
    expect(applyKey('12', 'del')).toBe('1');
    expect(applyKey('1', 'del')).toBe('');
  });
});

describe('helpers', () => {
  it('draws sparkline paths', () => {
    expect(sparkPath([1], 10, 10)).toBe('');
    expect(sparkPath([1, 2], 10, 10)).toMatch(/^M0\.0,9\.0 L10\.0,1\.0$/);
  });
  it('generates stable avatars', () => {
    expect(gradientFor('a')).toEqual(gradientFor('a'));
    expect(initialsOf('satoshi_sis')).toBe('SS');
    expect(initialsOf('$HOPE')).toBe('HO');
    expect(initialsOf('')).toBe('?');
    expect(cn('a', false, null, 'b')).toBe('a b');
  });
});
