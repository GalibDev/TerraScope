import { describe, it, expect } from "vitest";
import {
  prepare,
  monthly,
  trend,
  demo,
  seasonal,
  anomalies,
  rawSchema,
} from "../lib/analysis";
import { regions } from "../lib/regions";
describe("MODIS documented raw formats (synthetic fixtures)", () => {
  it("scales valid values and preserves scaled exports", () => {
    expect(
      prepare([{ date: "2020-01-01", value: 6000, qa: 0 }])[0].value,
    ).toBeCloseTo(0.6);
    expect(
      prepare([{ date: "2020-01-01", value: 0.6, qa: 0 }], true)[0].value,
    ).toBe(0.6);
  });
  it("rejects fill, out of range, malformed dates and missing values", () => {
    expect(
      prepare([
        { date: "2020-01-01", value: -3000, qa: 0 },
        { date: "bad", value: 4, qa: 0 },
        { date: "2020-01-01", value: 11000, qa: 0 },
        {},
      ]),
    ).toEqual([]);
    expect(
      rawSchema.safeParse({ date: "2020-02-30", value: 4, qa: 0 }).success,
    ).toBe(false);
  });
  it("filters clouds, aerosol, snow, shadow and bad MODLAND", () => {
    for (const qa of [1, 3, 1 << 8, 1 << 10, 1 << 14, 1 << 15, 3 << 6, 4 << 2])
      expect(prepare([{ date: "2020-01-01", value: 6000, qa }])).toEqual([]);
  });
  it("deduplicates timestamps and aggregates without interpolation", () => {
    const p = prepare([
      { date: "2020-01-01", value: 5000, qa: 0 },
      { date: "2020-01-01", value: 7000, qa: 0 },
      { date: "2020-01-17", value: 7000, qa: 0 },
      { date: "2020-03-01", value: 8000, qa: 0 },
    ]);
    expect(p.length).toBe(3);
    expect(monthly(p)[0].value).toBeCloseTo(0.6);
    expect(monthly(p).length).toBe(2);
  });
  it("estimates annual slope without unsupported significance claims", () => {
    const r = demo().map((r) => ({
      ...r,
      value: 0.3 + (+r.date.slice(0, 4) - 2001) * 0.01,
    }));
    expect(trend(r).slope).toBeCloseTo(0.01);
    expect(trend(r).classification).toBe("Insufficient data");
    expect(trend(r).interval).toBeNull();
  });
  it("requires five complete years", () => {
    expect(trend(demo().slice(0, 48)).classification).toBe("Insufficient data");
    expect(
      trend(demo().filter((r) => r.date.slice(5, 7) !== "12")).slope,
    ).toBeNull();
  });
  it("handles empty seasonal and anomaly baselines", () => {
    expect(seasonal([]).every((r) => r.value === null)).toBe(true);
    expect(anomalies(demo().slice(0, 12)).every((r) => r.z === null)).toBe(
      true,
    );
  });
  it("defines unique study locations within valid coordinates", () => {
    expect(new Set(regions.map((r) => r.id)).size).toBe(4);
    expect(
      regions.every(
        (r) => Math.abs(r.center[0]) <= 180 && Math.abs(r.center[1]) <= 90,
      ),
    ).toBe(true);
  });
});
