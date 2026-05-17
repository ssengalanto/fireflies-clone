import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          allowJs: true,
          isolatedModules: true,
        },
      },
    ],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // T120 — enforce ≥80% line coverage on the four most-leveraged layers per
  // the plan. The bar is intentionally not project-global: shadcn primitives
  // (components/ui) are vendored from the registry and exercised indirectly.
  coverageThreshold: {
    global: { lines: 0, statements: 0, branches: 0, functions: 0 },
    'lib/schemas/': { lines: 90, statements: 90 },
    'lib/store/': { lines: 90, statements: 90 },
    'lib/fetchers/': { lines: 80, statements: 80 },
    'lib/hooks/': { lines: 80, statements: 80 },
  },
}

export default config
