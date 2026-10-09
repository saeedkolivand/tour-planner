// The page's English text. de.ts has the same shape (the type is taken from this file).
export const en = {
  meta: {
    title: 'Tour Planner: the fastest delivery order from a photo of the scanner',
    description: 'Photograph a DPD scanner\'s stop list and get the fastest delivery order, grouped into park-and-walk stops, with one-tap navigation. iPhone and Android, planned on the phone.',
  },
  nav: { story: 'How it works', demo: 'Try it', built: 'How it\'s built', install: 'Install', theme: 'Switch light or dark', other: 'Deutsch', replay: 'Play the opening again' },
  hero: {
    kicker: 'For parcel drivers',
    title: 'Photograph the scanner. Drive the fastest tour.',
    body: 'Tour Planner reads the stop list off your scanner, plans the quickest order on your phone and groups the stops you can walk to, so you park once and deliver several.',
    cta: 'Download the app',
    demo: 'Try the planner',
    chips: ['iPhone and Android', 'Works without a server', 'English and Deutsch'],
  },
  story: {
    title: 'A day with Tour Planner',
    steps: [
      { title: 'Capture the list', body: 'Take photos or screenshots of the scanner\'s stop list. The phone reads them itself (Apple Vision or ML Kit) and checks the count against the scanner, so nothing is missing.' },
      { title: 'Plan in seconds', body: 'Every address is placed on the map, stops within a short walk share a parking spot, and the order is searched for ten seconds on the phone: one-way streets, Express deadlines and each street driven once.' },
      { title: 'Deliver, tap, go', body: 'The next stop with its loading number, a big Navigate button that opens Apple Maps, Google Maps or Waze, and Delivered, which goes straight on to the next one.' },
      { title: 'See how the day went', body: 'When the last stop is done: time on the road, minutes per stop, stops and parcels per hour, Express kept or missed. Every day is kept for a year to compare.' },
    ],
  },
  screens: {
    date: 'FRIDAY 9 OCT', stops: 'Stops', route: 'Route', scan: 'Scan', settings: 'Settings',
    capture: 'Capture the scanner list', captureSub: 'Read on this phone. Photos never leave it.', camera: 'Camera', shots: 'Screenshots',
    reading: 'Reading photo', of: 'of', countOk: 'Every stop on the scanner is captured.', parcels: 'parcels',
    left: 'PARKING STOPS LEFT', distance: 'Distance', time: 'Est. time', saved: 'time saved', delivered: 'Delivered',
    next: 'NEXT STOP', arrive: 'arrive', navigate: 'Navigate · Apple Maps', walk: 'Park once, then walk to',
    allDone: 'ALL DONE', done: 'Tour done', doneStops: '26 of 26 stops delivered · 61 parcels', span: '08:05 – 11:52 · 3h 47m',
    express: 'Express: all 9 on time', pace: '⌀ 6.1 min per stop · 6.9 stops/h · 16.1 parcels/h', vsPlan: 'Last stop 12 min earlier than planned',
    complete: 'Tour complete', past: 'Past deliveries', planned: '9.8 km, 3h 59m planned',
  },
  demo: {
    title: 'Try the planner',
    body: 'Twenty-six stops, in the order a scanner lists them. Press Plan: this runs the app\'s own planner, in your browser, with straight-line road times as the app uses offline. Drag a stop and plan again.',
    plan: 'Plan fastest route', planning: 'Searching', reset: 'Back to the scanner order',
    walk: 'Park & walk', door: 'Door to door', express: 'Express first',
    before: 'Scanner order', after: 'Planned', saved: 'saved', drive: 'min driving', stops: 'stops', parking: 'parking stops',
    legendExpress: 'Express', legendPark: 'Parking spot', legendStart: 'Start',
  },
  features: {
    title: 'Made for the van, not the office',
    items: [
      { icon: 'zap', title: 'Express on time', body: 'Deadlines at 10:00, 12:00 or 14:00 are planned around, with a buffer you choose, and a reminder before each one.' },
      { icon: 'footprints', title: 'Park once, walk', body: 'Stops within 80 m share a parking spot. Or door to door, if you prefer.' },
      { icon: 'road', title: 'Each street once', body: 'Both sides in one pass: the van stops on its side and you cross on foot, instead of driving the street twice.' },
      { icon: 'history', title: 'Past deliveries', body: 'Time per stop, per type and against the plan, kept on the phone for a year. Searchable by street or name.' },
      { icon: 'car', title: 'CarPlay and Live Activity', body: 'The next stop on the Lock Screen, the Dynamic Island and the CarPlay Dashboard, plus Siri: "delivered".' },
      { icon: 'settings', title: 'Settings where you expect them', body: 'In the app, grouped, and the everyday switches in the phone\'s own Settings app too.' },
    ],
  },
  built: {
    title: 'How it\'s built',
    body: 'One React Native code base for iPhone and Android, a planner that runs on the phone, and an optional home server for the best road data.',
    cols: [
      { title: 'On the phone', items: ['Expo SDK 57 · React Native 0.86 · New Architecture', 'Apple Vision and ML Kit read the photos', 'Reanimated on the UI thread, NativeWind design tokens', 'Live Activity, widgets and Siri on iOS'] },
      { title: 'The planner', items: ['Park-and-walk groups around the most central stop', 'Road times from OpenStreetMap routers, straight-line fallback offline', 'Iterated local search for ten seconds, seeded with VROOM', 'Within 0–2 min a day of the best order found on real 60-stop tours'] },
      { title: 'At home (optional)', items: ['VROOM and OSRM on a Cologne road graph, rebuilt nightly', 'City roadworks and closures you report, live', 'A local vision model reads photos, Claude as fallback', 'Reached privately over Tailscale'] },
    ],
    source: 'Source and decisions on GitHub',
  },
  install: {
    title: 'Install',
    body: 'Free, from the latest GitHub release. No store, no account with us.',
    ios: { title: 'iPhone', steps: ['Download TourPlanner-unsigned.ipa', 'Install it with Sideloadly and a free Apple ID', 'Trust your Apple ID under VPN & Device Management', 'Re-install the same file every 7 days'] },
    android: { title: 'Android', steps: ['Download TourPlanner.apk', 'Open it from the Files app', 'Allow installs from Files when asked', 'Android 7 or newer'] },
    cta: 'Latest release',
  },
  footer: 'Made in Cologne, for the van. Not affiliated with DPD.',
};

export type Text = typeof en;
