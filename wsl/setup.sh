#!/usr/bin/env bash
# One-time setup of the routing stack in WSL Ubuntu.
# Run as root once for packages:   wsl -d Ubuntu -u root -- bash wsl/setup.sh deps
# Then as your user for the rest:  wsl -d Ubuntu -- bash wsl/setup.sh build
set -euo pipefail

OSRM_VER=26.9.0
VROOM_TAG=v1.15.0
VROOM_EXPRESS_TAG=v0.12.0
PHOTON_VER=1.3.0
PBF_URL=https://download.geofabrik.de/europe/germany/nordrhein-westfalen/koeln-regbez-latest.osm.pbf
PHOTON_DB_URL=https://download1.graphhopper.com/public/europe/germany/photon-db-germany-1.0-latest.tar.bz2
DIR=${DPD_DIR:-$HOME/dpd}

deps() {
  apt-get update
  apt-get install -y build-essential git pkg-config curl pbzip2 \
    libasio-dev libglpk-dev libssl-dev \
    nodejs npm openjdk-21-jre-headless
}

build() {
  mkdir -p "$DIR" && cd "$DIR"

  # Photon + Germany DB (~7.4 GB download). Extract to a temp dir so a killed run never leaves a half DB.
  mkdir -p photon
  (cd photon
   curl -sSL -z photon.jar -o photon.jar https://github.com/komoot/photon/releases/download/$PHOTON_VER/photon-$PHOTON_VER.jar
   if [ ! -d photon_data ]; then
     rm -rf tmp && mkdir tmp && curl -sSL "$PHOTON_DB_URL" | pbzip2 -cd | tar x -C tmp && mv tmp/photon_data . && rm -rf tmp
   fi) &
  PHOTON_PID=$!

  # OSRM: the npm package ships prebuilt osrm-extract/-routed, no C++ build needed
  mkdir -p osrm && (cd osrm && npm install --no-save @project-osrm/osrm@$OSRM_VER >/dev/null)
  O=osrm/node_modules/@project-osrm/osrm

  # Map + routing graph (car, MLD)
  mkdir -p map
  curl -sSL -z map/koeln.osm.pbf -o map/koeln.osm.pbf "$PBF_URL"
  $O/lib/binding_napi_v8/osrm-extract -p $O/profiles/car.lua map/koeln.osm.pbf
  $O/lib/binding_napi_v8/osrm-partition map/koeln.osrm
  $O/lib/binding_napi_v8/osrm-customize map/koeln.osrm

  # VROOM
  [ -d vroom ] || git clone --depth 1 -b $VROOM_TAG --recurse-submodules https://github.com/VROOM-Project/vroom.git
  make -C vroom/src -j"$(nproc)"

  # vroom-express (HTTP wrapper around the vroom binary)
  [ -d vroom-express ] || git clone --depth 1 -b $VROOM_EXPRESS_TAG https://github.com/VROOM-Project/vroom-express.git
  (cd vroom-express && npm install --omit=dev >/dev/null)

  wait $PHOTON_PID
  echo "setup done in $DIR"
}

"${1:?usage: setup.sh deps|build}"
