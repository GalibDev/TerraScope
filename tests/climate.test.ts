import { expect, it } from "vitest";
import { climateMonths } from "../lib/climate";

it("preserves valid zero rainfall and below-freezing temperatures", () => {
  const data = climateMonths(2024, {
    T2M: { "202401": -5, "202413": 99 },
    PRECTOTCORR: { "202401": 0 },
  });
  expect(data).toHaveLength(12);
  expect(data[0]).toEqual({ month: "Jan", temperature: -5, precipitation: 0 });
  expect(data[11].month).toBe("Dec");
});

it("keeps missing, nonfinite and invalid rainfall values out of charts", () => {
  const data = climateMonths(2024, {
    T2M: { "202401": -999, "202402": NaN, "202403": Infinity },
    PRECTOTCORR: { "202401": -999, "202402": -1, "202403": Infinity },
  });
  expect(
    data.every((row) => row.temperature === null && row.precipitation === null),
  ).toBe(true);
  expect(climateMonths(2024, {})).toEqual(data);
});
