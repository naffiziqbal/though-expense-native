const { withGradleProperties } = require('expo/config-plugins');

function setGradleProp(properties, key, value) {
  const entry = properties.find((item) => item.type === 'property' && item.key === key);
  if (entry) {
    entry.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

/**
 * Play Console “R8 optimization” hints: full-mode R8 when Expo/RN release builds minify.
 * AGP 9+ / optimized resource shrink may require a future Expo SDK bump.
 */
module.exports = function withAndroidReleaseOptimizations(config) {
  return withGradleProperties(config, (config) => {
    setGradleProp(config.modResults, 'android.enableR8.fullMode', 'true');
    return config;
  });
};
