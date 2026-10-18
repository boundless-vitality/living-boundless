// The app name and scheme come from shared/src/brand.json (one place to change them).
const brand = require('../shared/src/brand.json');

module.exports = ({ config }) => ({
  ...config,
  name: brand.appName,
  slug: 'living-boundless',
  scheme: brand.scheme,
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: 'com.boundlessvitality.livingboundless',
  },
  plugins: [
    ...config.plugins,
    ['expo-camera', { cameraPermission: 'The camera is used to scan the plan QR code from your provider.' }],
    ['expo-image-picker', { photosPermission: 'Pick a photo of your plan QR code to add your plan.' }],
  ],
});
