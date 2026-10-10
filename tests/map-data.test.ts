import { describe, it, expect } from "vitest";
import { pointFeatures } from "../lib/map-data";
describe("Measured map points", () => {
  it("only displays registry locations and observed periods", () => {
    const s = [
      {
        region: "bangladesh",
        index: "NDVI",
        observations: [
          { date: "2020-01-01", value: 0.2 },
          { date: "2020-01-17", value: 0.6 },
          { date: "2020-02-01", value: 0.8 },
          { date: "2021-01-01", value: 1 },
        ],
      },
    ];
    const f = pointFeatures(s, "NDVI", 2020, 2020);
    expect(f.features).toHaveLength(1);
    expect(f.features[0].properties!.value).toBeCloseTo(0.6);
    expect(f.features[0].properties!.months).toBe(2);
    expect(pointFeatures(s, "EVI", 2020, 2020).features).toEqual([]);
    expect(pointFeatures(s, "NDVI", 2001, 2002).features).toEqual([]);
  });
});
