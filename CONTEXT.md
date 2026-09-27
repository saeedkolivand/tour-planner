# Glossary

- **Tour**: one driver's deliveries for one day. Shared by the web app and the iOS app.
- **Stop**: one address to deliver to, pick up from, or supply. Identified by street + house number, so the same address photographed twice is one stop.
- **Parcel**: one package. A stop can have several.
- **Stop type**: *private*, *business* (company or trade), *pickup* (Abholung / Retoure), or *Paketshop* (a DPD Pickup shop or parcel station being supplied). It decides the service time.
- **Service time**: minutes spent at a stop, from its type plus 30 s per extra parcel.
- **Cluster (park-and-walk)**: stops close enough together (80 m by default) to park once and walk to each.
- **Loading number**: the big number on each stop, handed out once at the first plan and never changed. It's written on the parcel, which is why it stays fixed.
- **Baseline order**: the order of the stops as they appeared on the scanner. Used only to show how much the plan saves.
- **Re-plan**: re-ordering the stops not yet delivered, starting from the phone's current position.
- **Express badge**: marks a stop with a DPD Express deadline (08:30, 10:00, 12:00, 18:00). It's for information only and never changes the order.
- **Ungeocoded stop**: a stop whose address could not be placed on the map. It's shown to the driver, never dropped silently.
- **Next stop**: the first parking stop in route order that isn't fully delivered. The driving screen revolves around it.
- **Auto-navigate**: after "Delivered", navigation to the next stop opens straight away in the chosen maps app, and so on CarPlay.
- **Closure**: a street the driver reported as closed. The route avoids it completely for 14 days, unless removed earlier.
- **One-way report**: a direction of a street the driver may no longer drive ("no entry this way"). The route never uses that direction for 180 days; the other direction stays open.
- **Traffic-calendar entry**: the city's own notice of a closure, narrowing or event for today. A full closure is avoided completely; the rest are slow-downs.
- **Roadworks slow-down**: a City of Cologne roadworks permit near a street. The route prefers other streets there, but may still use it.
- **Pin**: a stop position the driver fixed by hand. It overrides the geocoder for that address from then on.
