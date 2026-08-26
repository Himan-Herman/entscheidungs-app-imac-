import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    /*
     * Build output, in every place it lands.
     *
     * `dist` was already here. `ios/` and `android/` are Capacitor projects,
     * and `npx cap sync` copies the SAME built bundle into each of them —
     * ios/App/App/public and android/app/src/main/assets/public. Linting them
     * was linting `dist` twice more under different names: 1464 of the repo's
     * 1516 errors came from those copies, which is enough noise to hide the 52
     * that are about code anyone wrote.
     *
     * The native shells' own sources (Swift, Kotlin, Gradle) are not JavaScript
     * and were never linted; only the copied web assets were.
     */
    ignores: [
      'dist',
      'ios/App/App/public',
      'android/app/src/main/assets/public',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    /*
     * Build tooling runs in Node, not in a browser tab.
     *
     * Without this, `process.env` in vite.config.js is reported as `no-undef` —
     * a config gap, not a defect: the file cannot run anywhere else.
     */
    files: ['vite.config.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    /*
     * Service workers have their own global scope.
     *
     * `push-sw.js` runs as a worker, where `self` and `clients` are the real
     * globals. Linting it with browser globals reported `self` as redeclared —
     * a config gap, not a defect. The file carried an inline comment naming
     * those globals precisely because of it; declaring the right environment
     * is the honest fix, and the comment could then go.
     */
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
  },
]
