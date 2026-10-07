import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The repo root is the nearest ancestor of `cwd` holding pnpm-workspace.yaml. Resolved from cwd (not
 * import.meta.url) so it stays correct once this package is bundled into apps/api or apps/worker, and
 * never escapes the repo.
 */
export function findRepoRoot(from: string = process.cwd()): string | undefined {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Load the repo-root `.env` for local dev. Hosts inject env directly, so a missing file is fine. */
export function loadRootEnv(): void {
  const root = findRepoRoot();
  const path = root && join(root, '.env');
  if (path && existsSync(path)) process.loadEnvFile(path);
}
