import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { precacheList, injectPrecache } = require('../../scripts/precache.cjs') as {
  precacheList: (dist: string) => string[];
  injectPrecache: (sw: string, list: string[]) => string;
};

function fakeBuild(files: string[]): string {
  const dist = mkdtempSync(join(tmpdir(), 'steady-dist-'));
  for (const f of files) {
    mkdirSync(join(dist, f, '..'), { recursive: true });
    writeFileSync(join(dist, f), 'x');
  }
  return dist;
}

const SW = "const CACHE = 'steady-dev';\nconst PRECACHE = [];\n";

it('lists every file of the build the app may load, as site paths', () => {
  const dist = fakeBuild(['index.html', '_expo/static/js/web/index-1.js', '_expo/static/js/web/home-2.js', 'assets/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.3.wasm', 'sw.js']);
  expect(precacheList(dist)).toEqual(['/_expo/static/js/web/home-2.js', '/_expo/static/js/web/index-1.js', '/assets/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.3.wasm']);
});

it('writes the list into the service worker, with a cache name that changes with the build', () => {
  const a = injectPrecache(SW, ['/_expo/static/js/web/index-1.js']);
  const b = injectPrecache(SW, ['/_expo/static/js/web/index-2.js']);
  expect(a).toContain('const PRECACHE = ["/_expo/static/js/web/index-1.js"];');
  expect(a).toMatch(/const CACHE = 'steady-[0-9a-f]{10}';/);
  expect(a.match(/steady-[0-9a-f]{10}/)![0]).not.toBe(b.match(/steady-[0-9a-f]{10}/)![0]);
});

it('refuses a service worker without the placeholders, so a build never ships without its list', () => {
  expect(() => injectPrecache('// nothing here', [])).toThrow();
});
