import { describe, it, expect } from "vitest";
import { csvRecords, importCSV } from "../lib/import-csv";
const mapping = {
  date: "Date",
  qa: "QA",
  ndvi: "NDVI",
  evi: "EVI",
  latitude: "Latitude",
  longitude: "Longitude",
};
const header = "Date,Latitude,Longitude,NDVI,EVI,QA\r\n";
describe("Explicit AppEEARS CSV mapping (synthetic only)", () => {
  it("handles quoted fields, BOM and CRLF", () => {
    expect(csvRecords('\uFEFFa,b\r\n"x,y","quoted ""word"""\r\n')[0]).toEqual({
      a: "x,y",
      b: 'quoted "word"',
    });
  });
  it("normalizes US export dates and preserves raw values for later scale/QA filtering", () => {
    const r = importCSV(
      header + "02-18-2020,23.685,90.3563,6000,4000,0\r\n",
      mapping,
      [90.3563, 23.685],
    );
    expect(r[0].observations[0]).toEqual({
      date: "2020-02-18",
      value: 6000,
      qa: 0,
    });
    expect(r[1].index).toBe("EVI");
  });
  it("rejects missing columns, malformed dates and mixed coordinates", () => {
    expect(() =>
      importCSV("Date,NDVI\n2020-01-01,.5", mapping, [90.3563, 23.685]),
    ).toThrow("Missing CSV");
    expect(() =>
      importCSV(
        header + "02-30-2020,23.685,90.3563,.6,.4,0",
        mapping,
        [90.3563, 23.685],
      ),
    ).toThrow("invalid date");
    expect(() =>
      importCSV(
        header + "02-18-2020,22,90.3563,.6,.4,0",
        mapping,
        [90.3563, 23.685],
      ),
    ).toThrow("coordinates");
  });
  it("does not turn blank index or QA values into zero", () => {
    const r = importCSV(
      header + "2020-01-01,23.685,90.3563,,,\n",
      mapping,
      [90.3563, 23.685],
    );
    expect(r[0].observations).toEqual([]);
  });
});
