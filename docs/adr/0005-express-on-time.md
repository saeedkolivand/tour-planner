# 5. Express on time, everything else fastest

Date: 2026-09-27 · Status: accepted · Amends [ADR 1](0001-driver-time-objective.md)

## Context
ADR 1 ignored all time windows. Testing a dense 100-parcel tour in 50670 from the Erftstadt depot (Depot 0150)
with 16 Express stops (10:00 / 12:00 / 14:00) showed the fastest order missed 4 Express deadlines, while an order
that keeps all of them cost 1 minute. Missed Express parcels come back to the driver; Predict windows don't.

## Decision
- Express deadlines are hard constraints (VROOM time windows on the PC, a heavy lateness penalty in the phone's
  local search). Predict windows stay ignored.
- Deadlines count from the departure time: now, or the driver's usual "leave the depot at" when planning earlier.
- A deadline no order can keep doesn't fail the plan: that stop is planned the fastest way and flagged "can't make it".
- It's a setting ("Express on time", default on); off restores ADR 1 exactly.
- To make VROOM's clock match the ETAs the app shows, the PC now gives VROOM its own travel-time table
  (OSRM x city factor) instead of letting VROOM query OSRM. The same table reveals stops a closure has cut off,
  which are left out ("no road there today") instead of failing the whole tour.

## Consequences
- Usually a few minutes longer than the pure fastest tour, sometimes zero.
- The phone's penalty approach can't prove a deadline impossible; it reports the late stops it ends up with.
