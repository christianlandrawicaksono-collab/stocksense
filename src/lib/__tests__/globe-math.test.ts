import { describe, expect, it } from "vitest";
import {
  computeMarketSpikeHeight,
  computeSubsolarPoint,
  computeSunDirectionLocal,
  formatGeoCoordinates,
  latLonToSphereCoords,
} from "../globe-math";

describe("globe-math helpers", () => {
  it("projects cardinal lat/lon points accurately to Three.js SphereGeometry space", () => {
    const prime = latLonToSphereCoords(0, 0, 1);
    expect(prime.x).toBeCloseTo(1, 5);
    expect(prime.y).toBeCloseTo(0, 5);
    expect(prime.z).toBeCloseTo(0, 5);

    const northPole = latLonToSphereCoords(90, 0, 1);
    expect(northPole.x).toBeCloseTo(0, 5);
    expect(northPole.y).toBeCloseTo(1, 5);
    expect(northPole.z).toBeCloseTo(0, 5);
  });

  it("places subsolar longitude near 0° at 12:00 UTC and near +105°E at 05:00 UTC (Jakarta midday)", () => {
    const noonUtc = computeSubsolarPoint(new Date("2026-06-21T12:00:00Z"));
    expect(noonUtc.lon).toBeCloseTo(0, 1);
    expect(noonUtc.lat).toBeGreaterThan(22);
    expect(noonUtc.utcTimeLabel).toBe("12:00 UTC");

    const jktNoon = computeSubsolarPoint(new Date("2026-03-21T05:00:00Z"));
    expect(jktNoon.lon).toBeCloseTo(105, 1);

    const sunVec = computeSunDirectionLocal(new Date("2026-06-21T12:00:00Z"));
    const mag = Math.hypot(sunVec.x, sunVec.y, sunVec.z);
    expect(mag).toBeCloseTo(1, 5);
  });

  it("scales 3D market spike height monotonically and highlights selected hubs", () => {
    const low = computeMarketSpikeHeight(0.3, false);
    const high = computeMarketSpikeHeight(3.2, false);
    const selectedHigh = computeMarketSpikeHeight(3.2, true);
    expect(high).toBeGreaterThan(low);
    expect(selectedHigh).toBeGreaterThan(high);
  });

  it("formats geographic coordinates cleanly for HUD display", () => {
    expect(formatGeoCoordinates(-6.2088, 106.8456)).toBe("6.2°S · 106.8°E");
    expect(formatGeoCoordinates(40.7128, -74.006)).toBe("40.7°N · 74.0°W");
  });
});
