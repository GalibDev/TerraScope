import { parse } from "csv-parse/sync";
import { z } from "zod";
import { rawSchema } from "./analysis";
export type ColumnMapping = {
  date: string;
  qa: string;
  ndvi?: string;
  evi?: string;
  latitude: string;
  longitude: string;
};
export function csvRecords(text: string): Record<string, string>[] {
  return parse(text.replace(/^\uFEFF/, ""), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    max_record_size: 65536,
  });
}
export function importCSV(
  text: string,
  mapping: ColumnMapping,
  center: [number, number],
) {
  const records = csvRecords(text);
  if (!records.length) throw new Error("CSV contains no observations.");
  for (const column of [
    mapping.date,
    mapping.qa,
    mapping.ndvi,
    mapping.evi,
    mapping.latitude,
    mapping.longitude,
  ].filter(Boolean))
    if (!(column! in records[0]))
      throw new Error(`Missing CSV column: ${column}`);
  if (!mapping.ndvi && !mapping.evi)
    throw new Error("Map at least one index column.");
  const result: {
    index: "NDVI" | "EVI";
    observations: z.infer<typeof rawSchema>[];
  }[] = [];
  for (const [index, column] of [
    ["NDVI", mapping.ndvi],
    ["EVI", mapping.evi],
  ] as const) {
    if (!column) continue;
    const observations: z.infer<typeof rawSchema>[] = [];
    for (const [i, row] of records.entries()) {
      // Enforce registry coordinates instead of accidentally combining multiple samples by date.
      if (
        !row[mapping.latitude] ||
        !row[mapping.longitude] ||
        Math.abs(Number(row[mapping.longitude]) - center[0]) > 0.001 ||
        Math.abs(Number(row[mapping.latitude]) - center[1]) > 0.001 ||
        !Number.isFinite(Number(row[mapping.latitude])) ||
        !Number.isFinite(Number(row[mapping.longitude]))
      )
        throw new Error(
          `Row ${i + 2}: coordinates do not match the selected registry point.`,
        );
      const value = row[column],
        qa = row[mapping.qa];
      if (value === "" || qa === "") continue;
      const rawDate = row[mapping.date];
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(rawDate);
      const date = m ? `${m[3]}-${m[1]}-${m[2]}` : rawDate;
      const parsed = rawSchema.safeParse({
        date,
        value: Number(value),
        qa: Number(qa),
      });
      if (!parsed.success)
        throw new Error(
          `Row ${i + 2}: invalid date, index or DetailedQA value.`,
        );
      observations.push(parsed.data);
    }
    result.push({ index, observations });
  }
  return result;
}
