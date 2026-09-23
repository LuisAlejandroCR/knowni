// eslint.config.js: lint de todo el TypeScript del repositorio salvo la app móvil.
// Reglas con tipos: busca lo que el compilador no mira —imports muertos, promesas
// sueltas, conversiones a texto que pierden el dato—. La app tiene el suyo.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', 'app/**', 'contracts/**', 'circuits/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Un adaptador implementa un puerto asíncrono; que el de memoria no
      // tenga a quién esperar no lo hace un error, hace al puerto reemplazable.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/test/**/*.ts'],
    rules: {
      // `test()` de node:test devuelve una promesa que el runner ya espera.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
