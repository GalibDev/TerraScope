import "server-only";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prepare, rawSchema, coverage } from "./analysis";
import { join } from "node:path";
const provenanceSchema = z.object({
  taskId: z.string().min(1),
  retrievedAt: z.iso.datetime(),
  processingNotes: z.string().min(20),
});
export const datasetSchema = z
  .object({
    source: z.literal("MOD13Q1.061"),
    provenance: provenanceSchema,
    series: z
      .array(
        z.object({
          region: z.enum(["bangladesh", "assam", "chiang-mai", "riyadh"]),
          index: z.enum(["NDVI", "EVI"]),
          scaled: z.boolean(),
          provenance: provenanceSchema.optional(),
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
  let text: string;
  if (process.env.VEGETATION_DATA_URL) {
    const url = z.url().parse(process.env.VEGETATION_DATA_URL);
    if (
      !url.startsWith("https://") ||
      new URL(url).username ||
      new URL(url).password
    )
      throw Error("Dataset URL must be public HTTPS without credentials");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw Error("Dataset storage unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Empty dataset");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8_000_000) {
        await reader.cancel();
        throw Error("Dataset too large");
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks).toString("utf8");
  } else {
    try {
      text = process.env.VEGETATION_DATA_PATH
        ? await readFile(
            /* turbopackIgnore: true */ process.env.VEGETATION_DATA_PATH,
            "utf8",
          )
        : await readFile(
            join(process.cwd(), "data", "vegetation.json"),
            "utf8",
          );
    } catch (error) {
      if (
        !process.env.VEGETATION_DATA_PATH &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
        return null;
      throw error;
    }
  }
  if (text.length > 8_000_000) throw Error("Dataset too large");
  const dataset = datasetSchema.parse(JSON.parse(text));
  return {
    ...dataset,
    series: dataset.series.map((s) => ({
      ...s,
      observations: prepare(s.observations, s.scaled),
      coverage: coverage(s.observations, s.scaled),
      provenance: s.provenance || dataset.provenance,
    })),
  };
}
