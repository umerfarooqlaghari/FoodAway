const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

module.exports = {
  dependencies: {
    ...(isProduction
      ? {
          'expo-dev-client': { platforms: { ios: null, android: null } },
          'expo-dev-launcher': { platforms: { ios: null, android: null } },
          'expo-dev-menu': { platforms: { ios: null, android: null } },
        }
      : {}),
  },
};
