import "server-only";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prepare, rawSchema } from "./analysis";
export const datasetSchema = z
  .object({
    source: z.literal("MOD13Q1.061"),
    provenance: z.object({
      taskId: z.string().min(1),
      retrievedAt: z.iso.datetime(),
      processingNotes: z.string().min(20),
    }),
    series: z
      .array(
        z.object({
          region: z.enum(["bangladesh", "assam", "chiang-mai", "riyadh"]),
          index: z.enum(["NDVI", "EVI"]),
          scaled: z.boolean(),
          observations: z.array(rawSchema).max(20000),
        }),
      )
      .max(8),
  })
  .refine(
    (dataset) =>
      new Set(dataset.series.map((s) => `${s.region}:${s.index}`)).size ===
      dataset.series.length,
    { message: "Duplicate region/index series" },
  );
export async function loadDataset() {
  if (!process.env.VEGETATION_DATA_PATH) return null;
  const dataset = datasetSchema.parse(
    JSON.parse(await readFile(process.env.VEGETATION_DATA_PATH, "utf8")),
  );
  return {
    ...dataset,
    series: dataset.series.map((s) => ({
      ...s,
      observations: prepare(s.observations, s.scaled),
    })),
  };
}
