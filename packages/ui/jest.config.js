/** @type {import('jest').Config} */
module.exports = {
  displayName: 'ui',
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|nativewind|react-native-css-interop)',
  ],
};
