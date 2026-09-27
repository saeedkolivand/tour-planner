// Widget and Live Activity layouts (src/widgets) are bundled into expo-widgets' own JS runtime and render
// through SwiftUI (@expo/ui), not React Native, so they must not get NativeWind's JSX runtime.
const WIDGETS = /[\\/]src[\\/]widgets[\\/]/;
// A function, not a RegExp: Metro loads this config once without a filename, and Babel rejects
// string/RegExp overrides in that case.
const notWidget = filename => !filename || !WIDGETS.test(filename);

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      { test: notWidget, presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'] },
    ],
  };
};
