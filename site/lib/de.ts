import type { Text } from './en';

export const de: Text = {
  meta: {
    title: 'Tour Planner: die schnellste Zustellreihenfolge aus einem Foto vom Scanner',
    description: 'Die Stoppliste eines DPD-Scanners fotografieren und die schnellste Reihenfolge bekommen, in Park-und-Lauf-Stopps gruppiert, mit Navigation auf einen Tipp. iPhone und Android, geplant auf dem Handy.',
  },
  nav: { story: 'So geht\'s', demo: 'Ausprobieren', built: 'Technik', install: 'Installieren', theme: 'Hell oder dunkel', other: 'English', replay: 'Eröffnung noch einmal abspielen' },
  hero: {
    kicker: 'Für Paketfahrer',
    title: 'Scanner fotografieren. Die schnellste Tour fahren.',
    body: 'Tour Planner liest die Stoppliste vom Scanner, plant die schnellste Reihenfolge auf dem Handy und fasst Stopps zusammen, die du zu Fuß erreichst: einmal parken, mehrmals zustellen.',
    cta: 'App herunterladen',
    demo: 'Planer ausprobieren',
    chips: ['iPhone und Android', 'Läuft ohne Server', 'Deutsch und English'],
  },
  story: {
    title: 'Ein Tag mit Tour Planner',
    steps: [
      { title: 'Liste erfassen', body: 'Fotos oder Screenshots von der Stoppliste des Scanners. Das Handy liest sie selbst (Apple Vision oder ML Kit) und gleicht die Anzahl mit dem Scanner ab, damit nichts fehlt.' },
      { title: 'In Sekunden geplant', body: 'Jede Adresse kommt auf die Karte, Stopps in kurzer Laufweite teilen sich einen Parkplatz, und das Handy sucht zehn Sekunden nach der besten Reihenfolge: Einbahnstraßen, Express-Zeiten und jede Straße nur einmal.' },
      { title: 'Zustellen, tippen, weiter', body: 'Der nächste Stopp mit Ladenummer, ein großer Navigieren-Knopf für Apple Maps, Google Maps oder Waze, und Zugestellt führt direkt zum nächsten.' },
      { title: 'Sehen, wie der Tag lief', body: 'Nach dem letzten Stopp: Zeit unterwegs, Minuten pro Stopp, Stopps und Pakete pro Stunde, Express gehalten oder verpasst. Jeder Tag bleibt ein Jahr zum Vergleichen.' },
    ],
  },
  screens: {
    date: 'FREITAG, 9. OKT.', stops: 'Stopps', route: 'Route', scan: 'Scan', settings: 'Einstellungen',
    capture: 'Scanner-Liste erfassen', captureSub: 'Auf diesem Handy gelesen. Fotos bleiben darauf.', camera: 'Kamera', shots: 'Screenshots',
    reading: 'Lese Foto', of: 'von', countOk: 'Jeder Stopp vom Scanner ist erfasst.', parcels: 'Pakete',
    left: 'PARKSTOPPS ÜBRIG', distance: 'Strecke', time: 'Dauer', saved: 'gespart', delivered: 'Zugestellt',
    next: 'NÄCHSTER STOPP', arrive: 'an', navigate: 'Navigieren · Apple Karten', walk: 'Einmal parken, dann zu Fuß zu',
    allDone: 'ALLES ERLEDIGT', done: 'Tour erledigt', doneStops: '26 von 26 Stopps zugestellt · 61 Pakete', span: '08:05 – 11:52 · 3 Std. 47 Min.',
    express: 'Express: alle 9 pünktlich', pace: '⌀ 6,1 Min. pro Stopp · 6,9 Stopps/h · 16,1 Pakete/h', vsPlan: 'Letzter Stopp 12 Min. früher als geplant',
    complete: 'Tour abgeschlossen', past: 'Frühere Zustellungen', planned: '9,8 km, 3 Std. 59 Min. geplant',
  },
  demo: {
    title: 'Den Planer ausprobieren',
    body: 'Sechsundzwanzig Stopps, so wie ein Scanner sie auflistet. Tippe auf Planen: Das ist der Planer der App, hier in deinem Browser, mit Luftlinien-Fahrzeiten wie in der App offline. Zieh einen Stopp woanders hin und plane neu.',
    plan: 'Schnellste Route planen', planning: 'Suche', reset: 'Zurück zur Scanner-Reihenfolge',
    walk: 'Parken & laufen', door: 'Bis vor die Tür', express: 'Express zuerst',
    before: 'Scanner-Reihenfolge', after: 'Geplant', saved: 'gespart', drive: 'Min. Fahrt', stops: 'Stopps', parking: 'Parkstopps',
    legendExpress: 'Express', legendPark: 'Parkplatz', legendStart: 'Start',
  },
  features: {
    title: 'Gemacht für den Transporter, nicht fürs Büro',
    items: [
      { icon: 'zap', title: 'Express pünktlich', body: 'Zeiten um 10:00, 12:00 oder 14:00 werden eingeplant, mit einem Puffer deiner Wahl und einer Erinnerung vor jeder.' },
      { icon: 'footprints', title: 'Einmal parken, laufen', body: 'Stopps innerhalb von 80 m teilen sich einen Parkplatz. Oder bis vor jede Tür, wenn dir das lieber ist.' },
      { icon: 'road', title: 'Jede Straße einmal', body: 'Beide Seiten in einem Durchgang: Der Wagen hält auf seiner Seite, du gehst zu Fuß rüber, statt die Straße zweimal zu fahren.' },
      { icon: 'history', title: 'Frühere Zustellungen', body: 'Zeit pro Stopp, pro Art und gegenüber dem Plan, ein Jahr lang auf dem Handy. Nach Straße oder Name durchsuchbar.' },
      { icon: 'car', title: 'CarPlay und Live-Aktivität', body: 'Der nächste Stopp auf dem Sperrbildschirm, in der Dynamic Island und im CarPlay-Dashboard, dazu Siri: „Zugestellt“.' },
      { icon: 'settings', title: 'Einstellungen, wo man sie sucht', body: 'In der App, in Gruppen, und die wichtigsten Schalter auch in der Einstellungen-App des Handys.' },
    ],
  },
  built: {
    title: 'Technik',
    body: 'Eine React-Native-Codebasis für iPhone und Android, ein Planer, der auf dem Handy läuft, und ein optionaler Server zu Hause für die besten Straßendaten.',
    cols: [
      { title: 'Auf dem Handy', items: ['Expo SDK 57 · React Native 0.86 · New Architecture', 'Apple Vision und ML Kit lesen die Fotos', 'Reanimated auf dem UI-Thread, NativeWind-Design-Tokens', 'Live-Aktivität, Widgets und Siri auf iOS'] },
      { title: 'Der Planer', items: ['Park-und-Lauf-Gruppen um den zentralsten Stopp', 'Fahrzeiten von OpenStreetMap-Routern, offline per Luftlinie', 'Iterierte lokale Suche, zehn Sekunden, mit VROOM als Start', 'Bei echten Touren mit 60 Stopps 0–2 Min. am Tag von der besten gefundenen Reihenfolge'] },
      { title: 'Zu Hause (optional)', items: ['VROOM und OSRM auf einem Kölner Straßennetz, nachts neu gebaut', 'Baustellen der Stadt und gemeldete Sperrungen, live', 'Ein lokales Bildmodell liest Fotos, Claude als Rückfall', 'Privat über Tailscale erreichbar'] },
    ],
    source: 'Quellcode und Entscheidungen auf GitHub',
  },
  install: {
    title: 'Installieren',
    body: 'Kostenlos, aus dem neuesten GitHub-Release. Kein Store, kein Konto bei uns.',
    ios: { title: 'iPhone', steps: ['TourPlanner-unsigned.ipa herunterladen', 'Mit Sideloadly und einer kostenlosen Apple-ID installieren', 'Der Apple-ID unter VPN & Geräteverwaltung vertrauen', 'Alle 7 Tage dieselbe Datei neu installieren'] },
    android: { title: 'Android', steps: ['TourPlanner.apk herunterladen', 'In der Dateien-App öffnen', 'Installationen aus Dateien erlauben, wenn gefragt', 'Android 7 oder neuer'] },
    cta: 'Neuestes Release',
  },
  footer: 'Gemacht in Köln, für den Transporter. Keine Verbindung zu DPD.',
};
