// frontend/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix: Zustand (and other packages) ship ESM builds (.mjs) that use import.meta.env.
// Metro's web bundle output is not an ES module, so import.meta causes a SyntaxError
// ("Cannot use 'import.meta' outside a module") at runtime in the browser.
//
// Solution: when bundling for web, intercept any resolution that would produce a .mjs
// file and try the .js (CJS) counterpart first.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest
    ? (ctx, mod, plat) => originalResolveRequest(ctx, mod, plat)
    : (ctx, mod, plat) => ctx.resolveRequest(ctx, mod, plat);

  const result = resolve(context, moduleName, platform);

  if (platform === 'web' && result?.filePath?.endsWith('.mjs')) {
    const cjsPath = result.filePath.replace(/\/esm\/(.+)\.mjs$/, '/$1.js');
    if (cjsPath !== result.filePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(cjsPath)) {
          return { ...result, filePath: cjsPath };
        }
      } catch {
        // fall through to original result
      }
    }
  }

  return result;
};

module.exports = config;
