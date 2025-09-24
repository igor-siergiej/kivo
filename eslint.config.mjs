import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    js.configs.recommended,
    {
        ignores: ['.yarn/**/*', 'build/**/*', 'node_modules/**/*'],
    },
    {
        files: ['**/*.{ts,mts,cts}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            // Basic rules for kivo
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    // Additional specific configurations for kivo
    {
        // Enum and type definition files (relaxed unused vars)
        files: ['**/types/**/*.ts', '**/*.types.ts', '**/*.enum.ts', '**/lib/**/types.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
];