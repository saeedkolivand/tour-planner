// Android has no page for an app's own settings in its Settings app (iOS: withSettingsBundle.js). What it has: the
// app's "App info" page shows a settings button for an app that handles ACTION_APPLICATION_PREFERENCES, and its
// notification settings link "Additional settings in the app" for NOTIFICATION_PREFERENCES. Both open the app's own
// Settings tab: MainActivity turns either request into the tourplanner://settings link Expo Router opens.
const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

const FILTERS = [
  { action: [{ $: { 'android:name': 'android.intent.action.APPLICATION_PREFERENCES' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }] },
  { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.NOTIFICATION_PREFERENCES' } }] },
];

const KOTLIN = `
  // Android's app info settings button and the notification settings' link: open the Settings tab
  private fun toSettings(intent: Intent?) {
    if (intent != null && (intent.action == Intent.ACTION_APPLICATION_PREFERENCES || intent.hasCategory(Notification.INTENT_CATEGORY_NOTIFICATION_PREFERENCES))) {
      intent.action = Intent.ACTION_VIEW
      intent.data = Uri.parse("tourplanner://settings")
    }
  }

  override fun onNewIntent(intent: Intent) {
    toSettings(intent)
    super.onNewIntent(intent)
  }
`;

module.exports = function withAndroidAppSettings(config) {
  config = withAndroidManifest(config, cfg => {
    const main = cfg.modResults.manifest.application[0].activity.find(a => a.$['android:name'] === '.MainActivity');
    const filters = (main['intent-filter'] ??= []);
    for (const f of FILTERS) if (!filters.some(x => JSON.stringify(x) === JSON.stringify(f))) filters.push(f);
    return cfg;
  });
  return withMainActivity(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes('fun toSettings')) return cfg;
    src = src.replace(/^import android\.os\.Bundle$/m, 'import android.app.Notification\nimport android.content.Intent\nimport android.net.Uri\nimport android.os.Bundle');
    src = src.replace(/(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/, '$1    toSettings(intent)\n');
    src = src.replace(/(\n  \/\*\*\n   \* Returns the name of the main component)/, `${KOTLIN}$1`);
    if (!src.includes('toSettings(intent)\n') || !src.includes('fun toSettings')) throw new Error('[withAndroidAppSettings] MainActivity.kt changed shape; update the plugin');
    cfg.modResults.contents = src;
    return cfg;
  });
};
