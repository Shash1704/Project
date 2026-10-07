import { appEnv, authEnv, parseEnv } from '@pulse/shared';

export const env = { ...parseEnv(appEnv), ...parseEnv(authEnv) };
export const isProd = env.NODE_ENV === 'production';
