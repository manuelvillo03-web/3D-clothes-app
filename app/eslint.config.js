// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-demo/*'],
  },
  {
    // Las etiquetas de React Three Fiber (mesh, light...) llevan propiedades
    // de three.js que la regla de React no conoce.
    files: ['src/components/BodyViewer.tsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
