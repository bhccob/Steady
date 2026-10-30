// Metro for phones and the web. On the web, Steady's database is SQLite compiled to
// WebAssembly (expo-sqlite), which needs `.wasm` bundled and a cross-origin-isolated page,
// so the dev server sends the same two isolation headers that Vercel sends in production.
const { getDefaultConfig } = require('expo/metro-config');

const ISOLATION_HEADERS = require('./scripts/isolation-headers.json');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (req, res, next) => {
    for (const [name, value] of Object.entries(ISOLATION_HEADERS)) res.setHeader(name, value);
    return enhanced(req, res, next);
  };
};

module.exports = config;
