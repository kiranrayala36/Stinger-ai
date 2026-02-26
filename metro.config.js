const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove any existing extraNodeModules
config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-crypto'),
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  events: require.resolve('events/'),
  process: require.resolve('process'),
  url: require.resolve('react-native-url-polyfill'),
  stream: false,
  http: false,
  https: false,
  ws: null,
  zlib: false,
  path: false,
  fs: false,
  net: false,
  tls: false,
  util: false,
};

// Add support for .cjs files
config.resolver.sourceExts.push('cjs');

// Ensure WebSocket is properly resolved
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'cjs');
config.resolver.sourceExts.push('cjs');

module.exports = config; 