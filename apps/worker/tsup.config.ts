import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  // Workspace packages ship as TS source, so bundle them. Their npm deps (drivers) are also listed in
  // this app's package.json, which keeps them external — CJS drivers break when inlined into ESM.
  noExternal: [/^@pulse\//],
  sourcemap: true,
  clean: true,
});
