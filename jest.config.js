/** Logic tests run on Node against real SQLite (better-sqlite3). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, diagnostics: false, tsconfig: { module: 'commonjs', target: 'es2022', esModuleInterop: true, strict: true, skipLibCheck: true } }] },
  transformIgnorePatterns: ['/node_modules/(?!fast-xml-parser)'],
  testTimeout: 30000,
};
