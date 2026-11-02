/**
 * Release signing without committing secrets.
 *
 * The release build type is signed only when these environment variables are present at build time
 * (set from GitHub Actions secrets or your shell):
 *   PF360_KEYSTORE_PATH, PF360_KEYSTORE_PASSWORD, PF360_KEY_ALIAS, PF360_KEY_PASSWORD
 * Without them the release APK is produced UNSIGNED ("pending signing") instead of silently falling
 * back to the public debug key. The debug variant (APP_VARIANT=debug) keeps the debug key so it
 * installs anywhere for testing.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv("PF360_KEYSTORE_PATH")) {
                storeFile file(System.getenv("PF360_KEYSTORE_PATH"))
                storePassword System.getenv("PF360_KEYSTORE_PASSWORD")
                keyAlias System.getenv("PF360_KEY_ALIAS")
                keyPassword System.getenv("PF360_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (process.env.APP_VARIANT === 'debug' || g.includes('PF360_KEYSTORE_PATH')) return cfg;
    g = g.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_CONFIG);
    // Inside buildTypes.release, swap the template's debug signing for the release config (or none).
    g = g.replace(/(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/, '$1signingConfig System.getenv("PF360_KEYSTORE_PATH") ? signingConfigs.release : null');
    cfg.modResults.contents = g;
    return cfg;
  });
};
