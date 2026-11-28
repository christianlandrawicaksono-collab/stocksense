/**
 * Pure mathematical helpers for the 3D Orbital Earth Globe:
 * - Real-time UTC solar subsolar coordinates & 3D directional vector for Day/Night Terminator
 * - Spherical lat/lon projection matching Three.js SphereGeometry equirectangular UV
 * - Market spike height normalization and coordinate formatting
 */

const DEG2RAD = Math.PI / 180;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SubsolarPoint {
  lat: number;
  lon: number;
  utcTimeLabel: string;
}

/**
 * Projects geographic (lat, lon) onto a 3D sphere of given radius matching Three.js SphereGeometry UV.
 */
export function latLonToSphereCoords(lat: number, lon: number, radius: number = 1): Vec3 {
  const phi = (lon + 180) * DEG2RAD;
  const theta = (90 - lat) * DEG2RAD;
  const sinTheta = Math.sin(theta);
  return {
    x: -radius * sinTheta * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * sinTheta * Math.sin(phi),
  };
}

/**
 * Computes approximate real-time subsolar point (where the Sun is directly overhead)
 * from a UTC Date for the GLSL Day/Night Terminator shader.
 */
export function computeSubsolarPoint(date: Date = new Date()): SubsolarPoint {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);

  // Solar declination approximation (-23.44° at Dec solstice to +23.44° at Jun solstice)
  const declinationDeg = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  // Subsolar longitude: 0° at 12:00 UTC, moving westward 15° per hour
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lonDeg = (12 - utcHours) * 15;
  while (lonDeg > 180) lonDeg -= 360;
  while (lonDeg < -180) lonDeg += 360;

  const pad = (n: number) => String(n).padStart(2, "0");
  const utcTimeLabel = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;

  return {
    lat: declinationDeg,
    lon: lonDeg,
    utcTimeLabel,
  };
}

/**
 * Returns the normalized 3D sun direction vector in globe-local space.
 */
export function computeSunDirectionLocal(date: Date = new Date()): Vec3 {
  const subsolar = computeSubsolarPoint(date);
  return latLonToSphereCoords(subsolar.lat, subsolar.lon, 1);
}

/**
 * Scales a daily index percent change into a balanced 3D market spike height.
 */
export function computeMarketSpikeHeight(changePercent: number, isSelected: boolean): number {
  const absPct = Math.min(6, Math.abs(Number.isFinite(changePercent) ? changePercent : 0));
  const base = 0.032 + absPct * 0.014;
  return isSelected ? base + 0.022 : base;
}

/**
 * Formats geographic coordinates for the telemetry HUD (e.g., "6.2°S · 106.8°E").
 */
export function formatGeoCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${latDir} · ${Math.abs(lon).toFixed(1)}°${lonDir}`;
}
