#!/usr/bin/env bash
# Start OSRM (:5050), vroom-express (:3001) and Photon (:2322) in WSL. Idempotent.
# Windows reaches them on localhost via WSL port forwarding (so they must bind 0.0.0.0).
# OSRM is on 5050, not its default 5000, because a Windows app already holds :5000.
set -euo pipefail
DIR=${DPD_DIR:-$HOME/dpd}
cd "$DIR" && mkdir -p logs
up() { curl -s -o /dev/null "$1"; }
bg() { setsid nohup "$@" < /dev/null & } # detached, survives the wsl.exe call ending

OSRM_UP=localhost:5050/nearest/v1/driving/6.96,50.94
PHOTON_UP="localhost:2322/api?q=koeln&limit=1"
VROOM_UP=localhost:3001/health

O=osrm/node_modules/@project-osrm/osrm/lib/binding_napi_v8
up $OSRM_UP || bg $O/osrm-routed --algorithm mld --max-table-size 1000 -p 5050 map/koeln.osrm > logs/osrm.log 2>&1

sed -i -e "s|^  port: 3000|  port: 3001|" -e "s|^  path: ''|  path: '$DIR/vroom/bin/'|" \
  -e "s|^  threads: 4|  threads: 8|" -e "s|^  logdir: '/..'|  logdir: '/../../logs'|" \
  -e "/^  osrm:/,/^  ors:/ s|port: '5000'|port: '5050'|" vroom-express/config.yml
up $VROOM_UP || (cd vroom-express && bg node src/index.js > ../logs/vroom.log 2>&1)

up "$PHOTON_UP" || (cd photon && bg java -Xmx4g -jar photon.jar serve -listen-ip 0.0.0.0 > ../logs/photon.log 2>&1)

# the un-weighted twin graph the server snaps closures against (see osrm.sh)
bash "$(dirname "$0")/osrm.sh" plain

for i in $(seq 90); do
  up $OSRM_UP && up "$PHOTON_UP" && up $VROOM_UP && { echo "osrm :5050, vroom :3001, photon :2322 up"; exit 0; }
  sleep 1
done
echo "not all services came up, see $DIR/logs" >&2; exit 1
