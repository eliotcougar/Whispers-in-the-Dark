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
    tsconfigRootDir: __dirname,
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    /*'plugin:@typescript-eslint/stylistic',
    'plugin:@typescript-eslint/stylistic-type-checked'*/
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
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react/jsx-no-leaked-render': 'error',  
    'react/no-array-index-key' : 'warn',
    'react/jsx-newline': 'warn',
    'react/jsx-indent-props': ['warn', 2],
    'react/jsx-sort-props': 'warn'
    /*'@typescript-eslint/no-unnecessary-condition': 'error'*/
  }
}).map(c => ({ ...c, files: ['**/*.{ts,tsx}'] }));

export default [
  ignoreConfig,
  js.configs.recommended,
  ...compat.plugins('@typescript-eslint', 'react', 'react-hooks'),
  ...tsCompat
];
