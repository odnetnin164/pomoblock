module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@popup/(.*)$': '<rootDir>/src/popup/$1',
    '^@contentScript/(.*)$': '<rootDir>/src/contentScript/$1',
    '^@background/(.*)$': '<rootDir>/src/background/$1',
    '^@options/(.*)$': '<rootDir>/src/options/$1',
    '^@history/(.*)$': '<rootDir>/src/history/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ]
};