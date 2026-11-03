import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
