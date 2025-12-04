module.exports = {
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '*.config.js',
    '*.config.cjs',
  ],
};
