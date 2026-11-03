import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain browser scripts served from public/.
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    // The scoring module must stay pure: no server, no database, no file system.
    files: ['src/scoring/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['../server/*', 'node:*', 'pg', 'fastify', 'fastify/*', '@fastify/*'],
        },
      ],
    },
  },
);
