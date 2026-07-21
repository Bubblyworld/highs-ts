import { defineConfig } from 'rollup';

/**
 * The emscripten glue must stay a plain relative dynamic import in the dist
 * output: consumers' bundlers need to see the static specifier to include
 * the glue (and its wasm) in their bundles, so we must not inline it here.
 */
function isExternal(id) {
  return ['fs', 'path', 'url', 'module'].includes(id) || id.endsWith('build/highs.js');
}

function cjsImportMetaPlugin() {
  return {
    name: 'cjs-import-meta-url',
    resolveImportMeta(property, { format }) {
      if (property === 'url' && format === 'cjs') {
        return 'require("url").pathToFileURL(__filename).href';
      }
      return null;
    },
  };
}

export default defineConfig([
  {
    input: 'dist/index.node.js',
    output: {
      file: 'dist/index.node.js',
      format: 'es',
      sourcemap: true,
    },
    external: isExternal,
  },
  {
    input: 'dist/index.browser.js',
    output: {
      file: 'dist/index.browser.js',
      format: 'es',
      sourcemap: true,
    },
    external: isExternal,
  },
  {
    input: 'dist/index.node.js',
    output: { file: 'dist/index.node.cjs', format: 'cjs', sourcemap: true },
    external: isExternal,
    plugins: [cjsImportMetaPlugin()],
  },
]);
