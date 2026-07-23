const appJson = require('./app.json');

module.exports = () => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';
  const expo = { ...appJson.expo };

  expo.autolinking = {
    ios: {
      buildFromSource: [
        'expo-modules-core',
        'expo-location',
        'expo-font',
        'expo-file-system',
      ],
      exclude: [
        'expo-dev-client',
        'expo-dev-launcher',
        'expo-dev-menu',
        'expo-dev-menu-interface',
        'expo-audio',
        'expo-notifications',
      ],
    },
  };

  return { expo };
};
