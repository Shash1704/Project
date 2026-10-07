import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);
/** Blank lines in .env (`KEY=`) mean "not set", not "invalid". */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** A CA certificate may come from a file path or a base64 string (for hosts without secret files). */
const caFields = <P extends string>(prefix: P) =>
  ({
    [`${prefix}_CA_CERT_PATH`]: z.preprocess(blankToUndefined, nonEmpty.optional()),
    [`${prefix}_CA_CERT_BASE64`]: z.preprocess(blankToUndefined, nonEmpty.optional()),
  }) as unknown as Record<`${P}_CA_CERT_PATH` | `${P}_CA_CERT_BASE64`, z.ZodOptional<z.ZodString>>;

export const mysqlEnv = z.object({
  MYSQL_URL: z.url({ protocol: /^mysql$/ }),
  ...caFields('MYSQL'),
});

export const pgEnv = z.object({
  PG_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ...caFields('PG'),
});

export const kafkaEnv = z.object({
  KAFKA_BROKERS: nonEmpty.transform((s) =>
    s
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
  ),
  KAFKA_SASL_USERNAME: nonEmpty,
  KAFKA_SASL_PASSWORD: nonEmpty,
  KAFKA_SASL_MECHANISM: z
    .enum(['scram-sha-256', 'scram-sha-512', 'plain'])
    .default('scram-sha-256'),
  KAFKA_CLIENT_ID: nonEmpty.default('pulse'),
  ...caFields('KAFKA'),
});

export const valkeyEnv = z.object({
  VALKEY_URL: z.url({ protocol: /^rediss$/, error: 'VALKEY_URL must use rediss:// (TLS)' }),
});

export const opensearchEnv = z.object({
  OPENSEARCH_URL: z.url({ protocol: /^https$/, error: 'OPENSEARCH_URL must use https://' }),
});

export const appEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4100),
  WEB_ORIGIN: z.url().default('http://localhost:3100'),
});

export const authEnv = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Resend (https://resend.com) for OTP email. Unset → email login is disabled; demo login still works. */
  RESEND_API_KEY: nonEmpty.optional(),
  EMAIL_FROM: nonEmpty.default('Pulse <onboarding@resend.dev>'),
});

export type MysqlEnv = z.infer<typeof mysqlEnv>;
export type PgEnv = z.infer<typeof pgEnv>;
export type KafkaEnv = z.infer<typeof kafkaEnv>;
export type ValkeyEnv = z.infer<typeof valkeyEnv>;
export type OpensearchEnv = z.infer<typeof opensearchEnv>;
export type AppEnv = z.infer<typeof appEnv>;
export type AuthEnv = z.infer<typeof authEnv>;

/**
 * Parse env with a schema and throw an error that names missing/invalid variables
 * but never echoes their values.
 */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => {
    const key = i.path.join('.') || '(root)';
    const missing = !source[key]?.trim();
    return missing ? `${key} is not set` : `${key} is invalid`;
  });
  throw new Error(problems.join('; '));
}
