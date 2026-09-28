import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LEGAL_DOCS } from '../legal/content';

const dir = join(__dirname, '../../assets/legal');

describe('legal documents', () => {
  it('ships terms, privacy and risk in en and id', () => {
    for (const doc of ['terms', 'privacy', 'risk']) for (const lang of ['en', 'id']) expect(LEGAL_DOCS[`${doc}.${lang}`]).toBeTruthy();
  });

  it('is generated from the markdown sources (run `npm run legal`)', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      expect(LEGAL_DOCS[file.replace('.md', '')]).toBe(readFileSync(join(dir, file), 'utf8'));
    }
  });

  it('marks every document as a draft requiring lawyer review', () => {
    for (const [key, body] of Object.entries(LEGAL_DOCS)) {
      const notice = key.endsWith('.id') ? 'wajib ditinjau oleh pengacara' : 'must be reviewed by a qualified lawyer';
      expect([key, body.includes(notice)]).toEqual([key, true]);
    }
  });
});
