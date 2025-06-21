// Module: eslint.config.js
// Purpose: Provide ESLint configuration using the flat config format.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

// Resolve __dirname in an ES module environment.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: path.resolve(__dirname),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});


// Explicitly ignore generated and dependency directories.
const ignoreConfig = {
  ignores: ['node_modules', 'dist', 'build']
};

const tsCompat = compat.config({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: import.meta.dirname,
    ecmaVersion: 2020,
    projectService: true
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'plugin:react/all',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
    'plugin:@typescript-eslint/strict',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic',
    'plugin:@typescript-eslint/stylistic-type-checked'
  ],
  env: {
    browser: true,
    node: true,
    es6: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'react/jsx-no-literals': 'off',
    'react/forbid-component-props': 'warn',
    'react/destructuring-assignment': 'warn',
    'react/jsx-max-depth': [ 'warn', { max: 4 }],
    'react/jsx-no-leaked-render': 'error',  
    'react/no-array-index-key' : 'error',
    'react/jsx-no-bind': 'error',
    'react/no-object-type-as-default-prop': 'error',
    'react/prefer-read-only-props': 'error',
    'react/jsx-indent-props': ['warn', 2],
    'react/jsx-indent': ['warn', 2],
    'react/jsx-sort-props': 'warn',
    'react/sort-default-props': 'warn',
    'react/function-component-definition': 'warn',
    'react/require-default-props': 'warn',
    'react/jsx-closing-tag-location': ['warn', 'line-aligned'],
    'react/jsx-closing-bracket-location': ['warn', 'line-aligned'],
    'react/button-has-type': 'warn',
    'react/jsx-handler-names': 'warn',
    'react/jsx-filename-extension': ['warn', { extensions: ['.jsx', '.tsx'] }],
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
    '@typescript-eslint/no-confusing-void-expression': 'error',
    '@typescript-eslint/no-unnecessary-type-arguments': 'error',
    '@typescript-eslint/restrict-plus-operands': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'generic' }],
    '@typescript-eslint/consistent-indexed-object-style': ['warn', 'record'],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    "dot-notation": "off",
    "@typescript-eslint/dot-notation": "error"
  }
}).map(c => ({ ...c, files: ['**/*.{ts,tsx}'] }));

export default [
  ignoreConfig,
  js.configs.recommended,
  ...compat.plugins('@typescript-eslint', 'react', 'react-hooks'),
  ...tsCompat
];
