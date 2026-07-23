const { withAppBuildGradle } = require('expo/config-plugins');

const withPackagingConflictFix = (config) =>
  withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('META-INF/versions/9/OSGI-INF/MANIFEST.MF')) {
      return config;
    }
    config.modResults.contents = contents.replace(
      /android\s*\{/,
      `android {\n    packaging {\n        resources {\n            excludes += ['META-INF/versions/9/OSGI-INF/MANIFEST.MF']\n        }\n    }\n`
    );
    return config;
  });

module.exports = withPackagingConflictFix;
