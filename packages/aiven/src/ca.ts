import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { findRepoRoot } from './load-env';

/**
 * Resolve a CA certificate from `<PREFIX>_CA_CERT_PATH` (local dev) or `<PREFIX>_CA_CERT_BASE64` (hosts
 * without secret files). Path wins if both are set; relative paths resolve from the repo root.
 * TLS is mandatory, so a missing CA is an error.
 */
export function loadCaCert(prefix: string, env: NodeJS.ProcessEnv = process.env): string {
  const path = env[`${prefix}_CA_CERT_PATH`]?.trim();
  const b64 = env[`${prefix}_CA_CERT_BASE64`]?.trim();

  let pem: string;
  if (path) {
    try {
      const full = isAbsolute(path) ? path : resolve(findRepoRoot() ?? process.cwd(), path);
      pem = readFileSync(full, 'utf8');
    } catch {
      throw new Error(`${prefix}_CA_CERT_PATH points to a file that cannot be read`);
    }
  } else if (b64) {
    pem = Buffer.from(b64, 'base64').toString('utf8');
  } else {
    throw new Error(`Set ${prefix}_CA_CERT_PATH or ${prefix}_CA_CERT_BASE64`);
  }

  if (!pem.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error(`${prefix} CA certificate is not a PEM certificate`);
  }
  return pem;
}
