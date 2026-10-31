/**
 * Expo config plugin: release build settings for Vigil.
 *
 * Expo SDK 58's Android template enables R8 minification in release builds by
 * default. R8 removed the Room-generated WorkDatabase implementation that
 * WorkManager (used by expo-background-task) loads by reflection, so the app
 * crashed at startup with "Failed to create an instance of class
 * androidx.work.impl.WorkDatabase". Several native modules rely on reflection,
 * so release shrinking is disabled; keep rules are added as a second guard in
 * case it is ever re-enabled.
 */
const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEEP_RULES = `
# --- Vigil: classes loaded by reflection (WorkManager / Room / Expo modules) ---
-keep class androidx.work.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class **_Impl { *; }
-keep class expo.modules.** { *; }
-keep class com.facebook.react.** { *; }
`;

function setProp(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing) existing.value = value;
  else props.push({ type: 'property', key, value });
}

module.exports = function withReleaseBuildSettings(config) {
  config = withGradleProperties(config, (c) => {
    setProp(c.modResults, 'android.enableMinifyInReleaseBuilds', 'false');
    setProp(c.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'false');
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('Vigil: classes loaded by reflection')) fs.writeFileSync(file, current + KEEP_RULES);
      return c;
    },
  ]);
  return config;
};
