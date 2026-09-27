// expo-widgets gives its extension target the same build settings for Debug and Release, including
// SWIFT_OPTIMIZATION_LEVEL -Onone, so Release ships an unoptimized widget split into a debug dylib
// (ExpoWidgetsTarget.debug.dylib + __preview.dylib). This restores normal Release settings for it.
// CI fails if a *.debug.dylib reappears in the .ipa (.github/workflows/ios-unsigned.yml).
// Must be listed BEFORE expo-widgets in app.json: Expo runs Xcode-project mods in reverse plugin order,
// so this one then runs after expo-widgets has created the target.
const { withXcodeProject } = require('expo/config-plugins');

const TARGET = 'ExpoWidgetsTarget';
const RELEASE = { SWIFT_OPTIMIZATION_LEVEL: '"-O"', ENABLE_DEBUG_DYLIB: 'NO', ENABLE_PREVIEWS: 'NO', SWIFT_COMPILATION_MODE: 'wholemodule' };

module.exports = function withWidgetReleaseSettings(config) {
  return withXcodeProject(config, cfg => {
    const project = cfg.modResults;
    const target = project.pbxTargetByName(TARGET);
    if (!target) throw new Error(`[withWidgetReleaseSettings] no ${TARGET} target; list this plugin before expo-widgets in app.json`);
    const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
    const configs = project.pbxXCBuildConfigurationSection();
    for (const { value } of list.buildConfigurations) {
      const bc = configs[value];
      if (bc?.name === 'Release') Object.assign(bc.buildSettings, RELEASE);
    }
    return cfg;
  });
};
