import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'server-only': new URL('./tests/unit/server-only-stub.ts', import.meta.url).pathname },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    env: {
      PASS_TOKEN_SECRET: 'test-pass-secret-0123456789-abcdefghijklmnop',
      SELF_CHECKIN_SECRET: 'test-self-secret-0123456789-abcdefghijklmnop',
    },
  },
});
