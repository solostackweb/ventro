export default {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.config.jest.js' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@exodus|html-encoding-sniffer|jsdom|parse5|domhandler|domutils|entities|webidl-conversions|whatwg-url|tr46|cssom|cssstyle|nwsapi|parse5|dom-serializer|acorn|acorn-walk|rss-parser)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/tests/**/*.test.{js,ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};