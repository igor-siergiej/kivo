import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
    // Base configuration for all files
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.yarn/**',
            '**/test-results/**',
            '**/playwright-report/**',
            '**/*.tsbuildinfo'
        ]
    },

    // Base TypeScript configuration for all TS files
    {
        files: ['**/*.{ts,mts,cts}'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommended,
            ...tseslint.configs.stylistic,
        ],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'import': importPlugin,
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports,
            '@stylistic': stylistic,
        },
        rules: {
            // Apply stylistic rules first
            ...stylistic.configs.customize({
                braceStyle: '1tbs',
                commaDangle: 'only-multiline',
                indent: 4,
                quotes: 'single',
                semi: true,
            }).rules,
            // TypeScript-specific rules (these override the extended configs)
            '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
            '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
            '@typescript-eslint/no-unused-vars': 'off', // Let unused-imports handle this
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': 'off', // Disable for enum members

            // Import organization
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                    destructuredArrayIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],

            // Import rules
            'import/first': 'error',
            'import/newline-after-import': 'error',
            'import/no-duplicates': 'error',
        },
    },

    // Node.js specific configuration
    {
        files: ['**/*.ts'],
        rules: {
            // Node.js specific rules
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // Enum and type definition files (relaxed unused vars)
    {
        files: ['**/types/**/*.ts', '**/*.types.ts', '**/*.enum.ts', '**/lib/**/types.ts'],
        rules: {
            'unused-imports/no-unused-vars': 'off',
        },
    },

    // Test files configuration (relaxed rules)
    {
        files: ['**/*.{test,spec}.{ts}', '**/tests/**/*.{ts}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },

    // Configuration files (less strict)
    {
        files: ['**/*.config.{ts,js,mjs}', '**/playwright*.config.ts', '**/tsup.config.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'import/no-default-export': 'off',
        },
    }
);
