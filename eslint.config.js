import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      ecmaVersion: 2022,
      globals: {
        fetch: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransactionMode: 'readonly',
        IDBObjectStore: 'readonly',
        IDBRequest: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
]
