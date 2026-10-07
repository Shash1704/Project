const SECRET_KEY = /(PASSWORD|SECRET|TOKEN|KEY|URL|URI|BASE64)$/i;

/**
 * Strip anything credential-shaped from an error message before it is printed or logged:
 * URIs, `user:pass@` pairs, key=value secrets, and the literal values of secret-looking env vars.
 */
export function redact(message: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = message;
  for (const [k, v] of Object.entries(env)) {
    if (v && v.length >= 6 && SECRET_KEY.test(k)) out = out.split(v).join('[redacted]');
  }
  return out
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '[redacted-uri]')
    .replace(/\b[^\s:@/]+:[^\s@/]+@/g, '[redacted]@')
    .replace(/\b(password|passwd|pwd|secret|token)\s*[=:]\s*\S+/gi, '$1=[redacted]');
}

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message || err.name : String(err);
  return redact(raw.split('\n')[0] ?? raw);
}
