import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
    include: ['**/tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}']
  },
})