// UTM zone 32N (EPSG:25832, ETRS89 ≈ WGS84 at street scale) → lat/lon.
// Cologne's roadworks service returns 25832 whatever SRS is requested. Standard series inversion
// (Snyder, "Map Projections", USGS 1395), accurate to well under a metre in the zone.
const A = 6378137, F = 1 / 298.257222101, K0 = 0.9996, LON0 = 9 * Math.PI / 180;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

export function utm32ToLatLon(easting, northing) {
  const x = easting - 500000;
  const mu = northing / K0 / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
  const phi1 = mu
    + (3 * E1 / 2 - 27 * E1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * E1 ** 2 / 16 - 55 * E1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * E1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * E1 ** 4 / 512) * Math.sin(8 * mu);
  const sin = Math.sin(phi1), cos = Math.cos(phi1), tan = Math.tan(phi1);
  const C1 = EP2 * cos ** 2, T1 = tan ** 2;
  const N1 = A / Math.sqrt(1 - E2 * sin ** 2), R1 = A * (1 - E2) / (1 - E2 * sin ** 2) ** 1.5;
  const D = x / (N1 * K0);
  const lat = phi1 - (N1 * tan / R1) * (D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5 / 120) / cos;
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}
