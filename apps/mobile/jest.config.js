/** @type {import('jest').Config} */
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-.*|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|lucide-react-native|@gorhom/.*|@shopify/.*|nativewind|react-native-css-interop|@hopium/.*))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
};
