module.exports = {
  preset: 'ts-jest',
  modulePathIgnorePatterns: ['.*/dist/.*'],
  coveragePathIgnorePatterns: ['mocks'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.*'],
}
