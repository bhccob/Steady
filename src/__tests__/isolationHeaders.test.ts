import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The database on the web needs a cross-origin-isolated page. The same two headers are served by
// Metro and serve-web (scripts/isolation-headers.json) and by Vercel (vercel.json).
const ROOT = join(__dirname, '..', '..');
const local = JSON.parse(readFileSync(join(ROOT, 'scripts', 'isolation-headers.json'), 'utf8')) as Record<string, string>;
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };

it('uses require-corp, the embedder policy Safari on iPhone supports', () => {
  expect(local['Cross-Origin-Embedder-Policy']).toBe('require-corp');
  expect(local['Cross-Origin-Opener-Policy']).toBe('same-origin');
});

it('serves the same isolation headers locally and on Vercel', () => {
  const all = vercel.headers.find((h) => h.source === '/(.*)')!;
  expect(Object.fromEntries(all.headers.map((h) => [h.key, h.value]))).toEqual(local);
});
