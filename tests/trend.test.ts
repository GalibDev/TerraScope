import { describe, it, expect } from "vitest";
import { trend, monthly } from "../lib/analysis";
import reference from "./fixtures/hac-reference.json";
const observations = (annual: { year: number; value: number }[]) =>
  annual.flatMap((r) =>
    Array.from({ length: 12 }, (_, i) => ({
      date: `${r.year}-${String(i + 1).padStart(2, "0")}-01`,
      value: r.value,
    })),
  );
describe("Exploratory HAC uncertainty (synthetic fixtures)", () => {
  it("matches an independent NumPy matrix-sandwich reference", () => {
    const t = trend(observations(reference.annual));
    expect(t.slope).toBeCloseTo(reference.slope, 12);
    expect(t.standardError).toBeCloseTo(reference.standardError, 12);
    expect(t.interval![0]).toBeCloseTo(reference.interval[0], 12);
    expect(t.interval![1]).toBeCloseTo(reference.interval[1], 12);
    expect(t.lag).toBe(reference.lag);
  });
  it("classifies supported directions using uncertainty", () => {
    const positive = reference.annual.map((r, i) => ({
      ...r,
      value: 0.35 + i * 0.015 + (r.value - 0.45 - i * 0.002),
    }));
    expect(trend(observations(positive)).classification).toBe("Greening");
    expect(
      trend(observations(positive.map((r) => ({ ...r, value: 1 - r.value }))))
        .classification,
    ).toBe("Browning");
  });
  it("does not classify a positive slope whose interval crosses zero", () => {
    const t = trend(
      observations(
        reference.annual.map((r, i) => ({
          ...r,
          value: 0.5 + 0.00001 * i + 0.06 * Math.sin(i * 1.1),
        })),
      ),
    );
    expect(t.interval![0]).toBeLessThan(0);
    expect(t.interval![1]).toBeGreaterThan(0);
    expect(t.classification).toBe("No clear directional trend");
  });
  it("refuses inference over gaps and short records", () => {
    expect(
      trend(observations(reference.annual.slice(0, 19))).interval,
    ).toBeNull();
    expect(
      trend(observations(reference.annual.filter((r) => r.year !== 2010)))
        .interval,
    ).toBeNull();
  });
  it("does not manufacture uncertainty for a perfect line", () => {
    expect(
      trend(
        observations(
          reference.annual.map((r, i) => ({ ...r, value: 0.4 + i * 0.002 })),
        ),
      ).interval,
    ).toBeNull();
  });
  it("uses equal monthly weight even with multiple composites", () => {
    const r = observations(reference.annual);
    const extra = r
      .filter((r) => r.date.slice(5, 7) === "01")
      .map((r) => ({ ...r, date: r.date.slice(0, 8) + "17" }));
    expect(trend([...r, ...extra]).slope).toBeCloseTo(
      trend(monthly(r)).slope!,
      12,
    );
  });
});
