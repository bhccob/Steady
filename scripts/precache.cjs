// Runs after `expo export --platform web`: writes the full list of the build's files into
// dist/sw.js, so the service worker caches all of them when it installs. Every screen's code,
// the SQLite worker and its WebAssembly are then there for the very next offline open. The cache
// name comes from the list, so each deploy gets a fresh cache and the old one is cleared.
const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

const CACHED_DIRS = ['_expo/static', 'assets'];

function walk(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  } catch {
    return [];
  }
}

/** Every file under the build's code and asset folders, as site paths, sorted. */
function precacheList(dist) {
  return CACHED_DIRS.flatMap((d) => walk(join(dist, d)))
    .map((f) => '/' + relative(dist, f).split(sep).join('/'))
    .sort();
}

/** The service worker source with the list and a build-specific cache name filled in. */
function injectPrecache(sw, list) {
  const CACHE = "const CACHE = 'steady-dev';";
  const PRECACHE = 'const PRECACHE = [];';
  if (!sw.includes(CACHE) || !sw.includes(PRECACHE)) throw new Error('sw.js is missing its CACHE or PRECACHE placeholder');
  const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 10);
  return sw.replace(CACHE, `const CACHE = 'steady-${version}';`).replace(PRECACHE, `const PRECACHE = ${JSON.stringify(list)};`);
}

module.exports = { precacheList, injectPrecache };

if (require.main === module) {
  const dist = join(__dirname, '..', 'dist');
  const list = precacheList(dist);
  const file = join(dist, 'sw.js');
  writeFileSync(file, injectPrecache(readFileSync(file, 'utf8'), list));
  console.log(`sw.js: ${list.length} files to cache`);
}
