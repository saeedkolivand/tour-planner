# Driving the real iPhone from Windows (no Mac)

For testing the app on the phone the way the Android emulator is tested with mobile-mcp.
mobile-mcp's own iOS agent needs a paid-account re-sign, so `tools/iphone.mjs` talks to
Appium's WebDriverAgent (WDA) directly.

## Once
1. Developer Mode on the iPhone (Settings → Privacy & Security → Developer Mode).
2. WDA as an .ipa: `WebDriverAgentRunner-Runner.zip` from github.com/appium/WebDriverAgent releases,
   **minus** `PlugIns/WebDriverAgentRunner.xctest.dSYM` (AltServer's ldid can't sign dSYMs), zipped as
   `Payload/WebDriverAgentRunner-Runner.app`. Sideload it with AltServer; it becomes
   `com.facebook.WebDriverAgentRunner.xctrunner.<TEAMID>`. Free Apple ID: 3 apps, 7 days (AltStore refreshes).
3. pymobiledevice3 needs `qh3<2`: `python -m pip install --user "qh3>=1,<2"`.

## Each session (phone on USB, unlocked)
```
# Administrator PowerShell, keep open (iOS 17+ tunnel)
python -m pymobiledevice3 remote tunneld

# normal shell
python -m pymobiledevice3 mounter auto-mount --tunnel ""
python -m pymobiledevice3 developer dvt xcuitest com.facebook.WebDriverAgentRunner.xctrunner.<TEAMID> --tunnel ""   # keep running
python -m pymobiledevice3 usbmux forward 8100 8100                                                             # keep running
node tools/iphone.mjs status      # "WebDriverAgent is ready to accept commands"
```

`<TEAMID>` above: shown by AltStore next to the app, or `pymobiledevice3 apps list`.

## Use
```
node tools/iphone.mjs launch dev.saeed.tourplanner.<TEAMID>   # sideloaded build; BUNDLE_ID env var also works
node tools/iphone.mjs tree            # elements with centre points (iPhone points, not pixels)
node tools/iphone.mjs tap "Route"     # or: tap 246 787
node tools/iphone.mjs swipe 300 546 60 546
node tools/iphone.mjs shot shot.png
```
