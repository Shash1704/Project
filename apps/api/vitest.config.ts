import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    env: { JWT_SECRET: 'test-secret-test-secret-test-secret-0123', NODE_ENV: 'test' },
  },
});
