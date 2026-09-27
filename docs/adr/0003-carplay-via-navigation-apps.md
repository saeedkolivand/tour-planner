# 3. CarPlay without a CarPlay app: navigation hand-off, Live Activity, widget, Siri

Date: 2026-09-27 · Status: accepted (revised the same day to add the Live Activity, widget and Siri)

## Context
The driver wants to use the car's larger CarPlay screen. For an app to draw its own CarPlay templates, Apple must grant a CarPlay entitlement on request. That requires the paid Developer Program and a fitting category ("driving task" apps must not duplicate navigation, and are limited to 2–3 template levels). A free, sideloaded build can't carry it. iOS 26, however, shows **Live Activities and `systemSmall` widgets from any app** on CarPlay with no entitlement (WWDC25, "Turbocharge your app for CarPlay"). Free Apple IDs can sign the widget extension and App Group those need.

## Decision
Use every CarPlay surface that needs no entitlement:
1. **Navigation hand-off**: Apple Maps, Google Maps or Waze (all CarPlay apps). With *Auto-navigate*, "Delivered" immediately opens the next stop.
2. **"Next stop" Live Activity** via `expo-widgets` (`bannerSmall` is CarPlay's layout), updated locally by the app. No APNs push, since that would need the paid account.
3. **"Next stop" small widget**: glanceable on CarPlay's widget screen.
4. **Siri Shortcuts** calling `/siri/next` and `/siri/delivered` on the server, for hands-free use by voice with the phone locked.

## Consequences
- Everything works today with no Apple approval. Turn-by-turn quality is the maps apps'.
- Live Activities on CarPlay are display-only. Delivering is done on the phone or by voice.
- Voice deliveries change the server's tour; the app picks them up when it next becomes active, and the Live Activity follows then. Updating it remotely would need APNs (paid).
- If an entitlement is granted later, a CarPlay list template can reuse `useDelivery`, the selectors and `nextStopProps` unchanged.
