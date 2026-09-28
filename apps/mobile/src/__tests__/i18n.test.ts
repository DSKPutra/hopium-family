import en from '../i18n/en.json';
import id from '../i18n/id.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const EN = flatten(en as Tree);
const ID = flatten(id as Tree);
const vars = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((v) => v.replace(/\s/g, '')).sort();

describe('i18n', () => {
  it('has identical keys in en and id', () => {
    expect(Object.keys(ID).sort()).toEqual(Object.keys(EN).sort());
  });

  it('keeps interpolation variables in sync', () => {
    for (const key of Object.keys(EN)) expect([key, vars(ID[key] ?? '')]).toEqual([key, vars(EN[key] ?? '')]);
  });

  it('has no empty strings', () => {
    for (const [key, value] of [...Object.entries(EN), ...Object.entries(ID)]) expect([key, value.trim().length > 0]).toEqual([key, true]);
  });

  it('never promises profits (banned phrases)', () => {
    const banned = ['guaranteed', 'guarantee profit', 'risk-free', 'risk free', 'pasti untung', 'tanpa risiko', 'dijamin untung'];
    for (const [key, value] of [...Object.entries(EN), ...Object.entries(ID)]) {
      const lower = value.toLowerCase();
      // Negated forms ("does not guarantee") are the required disclaimers.
      const cleaned = lower.replace(/(does not|doesn't|not a|tidak) (guarantee|menjamin)\w*/g, '');
      for (const phrase of banned) expect([key, cleaned.includes(phrase)]).toEqual([key, false]);
    }
  });

  it('includes the spec copy samples', () => {
    expect(EN['home.emptyFollowingTitle']).toBe('your feed is quiet. follow some legends.');
    expect(ID['home.emptyFollowingTitle']).toBe('feed kamu masih sepi. yuk follow para legend.');
    expect(EN['order.firstTrade']).toBe('first trade done. welcome to the family 🫶');
    expect(ID['leaderboard.rankUp']).toBe('kamu naik. peringkat #{{rank}} 🚀');
    expect(EN['copy.disclaimer']).toBe('Copying a trade does not guarantee the same result.');
    expect(ID['perps.nearLiquidation']).toBe('Posisi {{market}} kamu mendekati estimasi harga likuidasi.');
  });
});
