#!/usr/bin/env bash
# Keeps the Cologne road graph fresh. Called by the app server (server/roads/*), logs to stdout.
#   osrm.sh apply  [speeds.csv]  re-weight the routing graph (closures / roadworks), restart it: ~seconds
#   osrm.sh refresh [speeds.csv] download today's OSM extract, rebuild, swap in, apply speeds: ~minutes
#   osrm.sh plain                make sure the plain graph (:5051) exists and runs
# Three copies of one extract:
#   map-base/   pristine: extracted + partitioned, never customized. osrm-customize writes speeds INTO the
#               graph files, so re-weighting map/ in place kept every closure ever applied (a removed closure or
#               an ended roadwork stayed until the next map download). Every apply starts again from here.
#   map/        :5050  routing: map-base + today's speeds
#   map-plain/  :5051  map-base, never re-weighted; the server snaps closure points against it, because routes
#                      on the re-weighted graph avoid slowed streets and can't cross closed ones
# speeds.csv: "from_osm_node,to_osm_node,kmh" per line (OSRM segment-speed-file). 0 km/h = closed.
set -euo pipefail
DIR=${DPD_DIR:-$HOME/dpd}
cd "$DIR"
O=osrm/node_modules/@project-osrm/osrm/lib/binding_napi_v8
PBF_URL=https://download.geofabrik.de/europe/germany/nordrhein-westfalen/koeln-regbez-latest.osm.pbf
SPEEDS=${2:-}

customize() { # $1 graph dir, $2 optional speeds file
  if [ -n "${2:-}" ] && [ -s "$2" ]; then
    $O/osrm-customize "$1/koeln.osrm" --segment-speed-file "$2" > /dev/null
    echo "$1 customized with $(wc -l < "$2") speed updates"
  else
    $O/osrm-customize "$1/koeln.osrm" > /dev/null
    echo "$1 customized with no speed updates"
  fi
}

serve() { # $1 graph dir, $2 port
  pkill -f "osrm-routed.*-p $2 " || true
  sleep 1
  setsid nohup $O/osrm-routed --algorithm mld --max-table-size 1000 -p "$2" "$1/koeln.osrm" > "logs/osrm-$2.log" 2>&1 < /dev/null &
  for _ in $(seq 60); do curl -s -o /dev/null "localhost:$2/nearest/v1/driving/6.96,50.94" && { echo "osrm-routed :$2 up ($1)"; return 0; }; sleep 1; done
  echo "osrm-routed :$2 did not come back" >&2; return 1
}

build() { # $1 dir holding koeln.osm.pbf: extract + partition, no weights yet
  $O/osrm-extract -p osrm/node_modules/@project-osrm/osrm/profiles/car.lua "$1/koeln.osm.pbf" > logs/refresh.log 2>&1
  $O/osrm-partition "$1/koeln.osrm" >> logs/refresh.log 2>&1
}

base() { # first run after the map-base change: rebuild it from the extract we already have (~minutes)
  [ -f map-base/koeln.osrm.partition ] && return 0
  echo "building pristine map-base from $(date -r map/koeln.osm.pbf -I) extract"
  rm -rf map-base.tmp && mkdir -p map-base.tmp && cp map/koeln.osm.pbf map-base.tmp/
  build map-base.tmp && mv map-base.tmp map-base
}

fresh() { # $1 dir: an exact copy of map-base
  rm -rf "$1.tmp" && cp -r map-base "$1.tmp" && rm -rf "$1" && mv "$1.tmp" "$1"
}

plain() { # the un-weighted graph, rebuilt whenever map-base changed
  if [ ! -f map-plain/koeln.osrm.partition ] || [ map-base/koeln.osrm.partition -nt map-plain/koeln.osrm.partition ] || [ "${1:-}" = force ]; then
    fresh map-plain && touch map-plain/koeln.osrm.partition && customize map-plain
    serve map-plain 5051 # restart: a running one keeps the old graph in memory
  fi
  curl -s -o /dev/null localhost:5051/nearest/v1/driving/6.96,50.94 || serve map-plain 5051
}

apply() { # routing graph = map-base + speeds, served on :5050
  fresh map && customize map "$SPEEDS" && serve map 5050
}

case "${1:?usage: osrm.sh apply|refresh|plain [speeds.csv]}" in
  apply)
    base
    apply
    plain
    ;;
  plain)
    base
    plain
    ;;
  refresh)
    base
    rm -rf map-next && mkdir -p map-next
    # -z: only download when Geofabrik has a newer extract (they publish daily)
    curl -sSL -z map-base/koeln.osm.pbf -o map-next/koeln.osm.pbf "$PBF_URL" || { echo "download failed" >&2; exit 1; }
    if [ ! -s map-next/koeln.osm.pbf ]; then echo "map unchanged since $(date -r map-base/koeln.osm.pbf -I)"; rm -rf map-next; apply; exit 0; fi
    build map-next
    rm -rf map-prev && mv map-base map-prev && mv map-next map-base
    apply
    plain force
    echo "map refreshed to the $(date -r map-base/koeln.osm.pbf -I) extract"
    ;;
  *) echo "unknown command $1" >&2; exit 2 ;;
esac
