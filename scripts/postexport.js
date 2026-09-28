// Post-process the SPA web export: copy static brand files and the service worker.
const fs = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '../apps/mobile/dist');
const pub = path.resolve(__dirname, '../apps/mobile/public');
if (fs.existsSync(pub)) fs.cpSync(pub, dist, { recursive: true });
for (const f of ['og-image.png', 'apple-touch-icon.png', 'favicon.png']) {
  const src = path.resolve(__dirname, '../apps/mobile/assets/images', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, f));
}
console.log('✓ post-export assets copied');
