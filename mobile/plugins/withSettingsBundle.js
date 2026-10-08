// The app's page in the iOS Settings app: copies ios-settings/Settings.bundle into the generated Xcode project and adds
// it to the app's resources (Apple: "Adding a settings interface to your app"). The values are mirrored with the app's
// own settings in src/features/settings/systemSettings.ios.ts.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const BUNDLE = 'Settings.bundle';

module.exports = function withSettingsBundle(config) {
  config = withDangerousMod(config, ['ios', cfg => {
    const name = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    fs.cpSync(path.join(cfg.modRequest.projectRoot, 'ios-settings', BUNDLE), path.join(cfg.modRequest.platformProjectRoot, name, BUNDLE), { recursive: true });
    return cfg;
  }]);
  return withXcodeProject(config, cfg => {
    const name = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${name}/${BUNDLE}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName: name, project: cfg.modResults, isBuildFile: true, verbose: true });
    }
    return cfg;
  });
};
