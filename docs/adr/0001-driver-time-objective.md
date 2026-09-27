# 1. Optimise for the driver's time; ignore customer time windows

Date: 2026-09-27 · Status: accepted, amended for Express by [ADR 5](0005-express-on-time.md)

## Context
DPD Predict gives each private recipient a 1-hour window computed from DPD's own stop order, and Express parcels carry guaranteed deadlines. Respecting both makes this a vehicle routing problem with time windows (VRPTW). Ignoring them makes it a plain travelling-salesman problem (TSP).

## Decision
The objective is the driver's total tour time (driving plus stops) only. It's solved as a TSP by VROOM on a self-hosted OSRM road graph for the Regierungsbezirk Köln. Express deadlines are shown as a badge and never constrain the order. This was the driver's explicit choice.

## Consequences
- Plans are shorter than any window-respecting plan, but Predict windows and Express deadlines can be missed. Missed Express deadlines are reported back to the depot.
- Switching to windows later is contained in `server/route/solve.mjs`: VROOM already supports `time_windows` and `priority` on jobs, and the reader already extracts the Express time.
