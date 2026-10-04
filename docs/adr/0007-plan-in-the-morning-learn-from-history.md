# 7. Plan once in the morning, learn from the driver's own tours

Date: 2026-10-04 · Status: accepted

## Context
The driver delivers in the same area every day and does not want the route to change mid-tour. The ordering is
already close to the best for the travel times it is given; what is weak are those inputs: the door point from a
geocoder, road times from a public table, a fixed number of minutes per stop. Published last-mile work points the
same way: the winning entries of Amazon's 2021 routing challenge learned the zone order from drivers' past routes,
and Deutsche Post learns which streets come before which from its couriers' history. A driver repeating one area
is the case where that pays most.

## Decision
- **No live rerouting.** The order is set once, when the driver plans. Delivering out of order, a slow stop or
  traffic never reshuffles it; only the ETAs move. A re-plan happens only when the driver asks for one.
- **Record first (this step), use later.** Each day the phone keeps one record (`history/<date>.json` in the app's
  documents, about 40 KB, kept 120 days): every stop with its place in the scanner list and on the plan, when it was
  delivered, where the phone was at that Delivered tap, and each plan of the day. Stops also keep the scanner's
  letters after the postcode (`area`, "50670HY" → "HY") and its route code (`code`, "G 12 T 387"), whose meaning
  the data should show.
- **One position per Delivered tap**, never background tracking, never a permission prompt at a door
  (`quietPosition` in `mobile/src/services/location.ts`). Settings › Log › Tour history turns recording off.
- The history stays on the phone; it leaves it only inside Settings › Log › Export log.

## Consequences
- No visible change yet; plans are as before until the history is used (parking spots from where the driver
  actually stopped, preferred street order, real stop times, finishing an area before leaving it).
- Same-input-same-order is not guaranteed yet: the phone's local search stops after 1.5 s, which at 60–90 parking
  stops is only a few improvement rounds, so a slower moment can give a slightly different order. A faster solver
  (move costs computed incrementally) would fix that and improve plans; left for the step that uses the history.
