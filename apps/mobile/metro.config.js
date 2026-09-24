// Expo configures Metro for npm-workspace monorepos automatically (SDK 52+);
// NativeWind compiles global.css + tailwind.config.js into native styles.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
