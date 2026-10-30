import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(__dirname, '..', '..', 'public');

it('ships a manifest that installs full screen with every icon present', () => {
  const m = JSON.parse(readFileSync(join(PUB, 'manifest.webmanifest'), 'utf8'));
  expect(m).toMatchObject({
    name: 'Steady',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    theme_color: '#F5F3EF',
    background_color: '#F5F3EF',
  });
  expect(m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? 'any'}`).sort()).toEqual([
    '192x192:any',
    '512x512:any',
    '512x512:maskable',
  ]);
  for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-512.png']) {
    expect(existsSync(join(PUB, f))).toBe(true);
  }
});
