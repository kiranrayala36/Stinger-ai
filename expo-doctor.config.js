module.exports = {
  checkPackageVersions: false,
  packagesVersionCheck: {
    enabled: false,
    ignoredPackages: ['@expo/config-plugins'],
    checkNativeModules: false
  },
  reactNativeDirectoryCheck: {
    exclude: [
      '@craftzdog/react-native-buffer',
      'react-native-crypto',
      'react-native-fs',
      'react-native-pell-rich-editor',
      '@fortawesome/free-solid-svg-icons'
    ],
    listUnknownPackages: false
  },
  configPathCheck: {
    enabled: false
  }
}; 