# 4. Fresh road data: nightly OSM, city roadworks, reported closures (not Google)

Date: 2026-09-27 · Status: accepted

## Context
Signs change and streets are dug up daily in Cologne, and the planning graph was a one-time OpenStreetMap snapshot. Google's map data can't be self-hosted. Its traffic-aware Route Matrix is billed per element (origins × destinations): a ~100-stop tour is ~10,000 elements at $10 per 1,000 (Pro SKU), with 5,000 free per month, so roughly $50–100 per tour day.

## Decision
- **Nightly OSM refresh** (03:30): download Geofabrik's daily extract when newer, rebuild in `map-next/`, swap it in, restart. Scheduled by the app server itself, so no OS scheduler is needed.
- **City roadworks** (startup + 05:30): the City of Cologne's WFS (EPSG:25832 points, converted in `utm.mjs`). Only driving-relevant categories are used, as *slow-downs* (5 / 15 km/h), because permits carry no "closed" flag and the permit period isn't the work period.
- **Reported closures**: 0 km/h for 14 days, applied in seconds through OSRM's MLD `osrm-customize --segment-speed-file` (no re-extraction).
- **Snapping points to segments**: short routes *across* the point on an un-weighted twin graph (`:5051`), keeping segments within 15–20 m. Two approaches were rejected, both found while testing:
  - `/nearest`: in OSRM 26 it returns `[node, node]` whenever it snaps to a segment's end node, which misses main roads near junctions.
  - Snapping on the routing graph: routes there avoid slowed streets and can't cross closed ones, so a second closure report could drop the first.

## Consequences
- It costs nothing and keeps customer data local. The graph is at most one day behind OSM. Roadworks follow the city's permits, not the actual work on site.
- The PC must be on at 03:30 and 05:30. A missed run just keeps the previous data (logged).
- It needs about 1 GB of extra disk (twin graph plus previous graph) and about 0.3 GB of RAM for the second OSRM.
- Live traffic while driving remains the navigation apps' job (ADR 0003).
