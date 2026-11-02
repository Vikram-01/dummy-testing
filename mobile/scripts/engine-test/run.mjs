// End-to-end test of the on-device engine (vault encryption, passcode, every local endpoint).
// Phone-only modules are replaced by in-memory stubs. Run: npm run test:engine
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
await build({
  entryPoints: [resolve(here, 'test.ts')], bundle: true, platform: 'node', format: 'cjs', logLevel: 'error',
  outfile: resolve(here, '.out.cjs'),
  alias: { '@': root + '/src', 'expo-secure-store': resolve(here, 'stubs-secure.js'), 'expo-crypto': resolve(here, 'stubs-crypto.js'), 'expo-file-system': resolve(here, 'stubs-fs.js') },
  nodePaths: [root + '/node_modules'], define: { __DEV__: 'false', 'process.env.EXPO_PUBLIC_DEMO_MODE': '"1"' },
});
execFileSync('node', [resolve(here, '.out.cjs')], { stdio: 'inherit' });
