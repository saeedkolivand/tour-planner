# 6. Drive each street once

Date: 2026-10-04 · Status: accepted · Amends the kerb-side arrival of commit 80c80cb

## Context
Every parking stop was reached at the right-hand kerb (OSRM `approaches=curb`), so the van never stopped across the
road from a door. On a two-way street with stops on both sides that forces two passes: up the street for one side,
round the block and back down for the other. On a real tour the driver noticed driving the same streets two and
three times. The solver also only weighed the clock, so a stretch of street could be left for a side street and
come back to later whenever that saved a few seconds, which is not how a driver works a street.

## Decision
- **Both sides in one pass** is the default (a setting, on the PC and the phone): parking stops are reached from
  either direction, the van stops on its own side and the driver crosses on foot. Dual carriageways are two one-way
  roads in OpenStreetMap, so a stop there still snaps to its own side. Off restores the kerb side everywhere.
- **No coming back to a stretch of street.** Parking stops parked on the same street within 300 m are one stretch.
  Leaving a stretch and returning to it later costs 90 s on top of the driving time (`REVISIT_SEC`, an environment
  variable on the PC), so a re-visit is only planned when it saves more than that. Same rule in the phone's solver
  (`mobile/src/features/planner/solve.ts`) and the PC's local search after VROOM (`server/route/order.mjs`).
- **Express first** (a setting, off by default) uses the same mechanism: an ordinary parking stop before an Express
  one costs 10⁷ s, so the local search never plans one.

## Consequences
- Fewer U-turns and loops; a few more walks across the road.
- The plan can be up to 90 s per avoided re-visit slower on paper than the pure-clock order; drivers asked for that.
- VROOM still sees only the clock; the preferences live in the local search that runs after it.
