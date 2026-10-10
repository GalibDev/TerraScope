import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  appeearsToken,
  submitPoint,
  taskStatus,
  bundle,
  downloadFile,
} from "../lib/nasa";
import { regions } from "../lib/regions";
import { csvRecords, importCSV } from "../lib/import-csv";
import { datasetSchema } from "../lib/dataset";
import { coverage } from "../lib/analysis";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      "region",
      "start",
      "end",
      "task",
      "out",
      "file",
      "date-column",
      "qa-column",
      "ndvi-column",
      "evi-column",
      "latitude-column",
      "longitude-column",
      "scaled",
      "notes",
    ].map((k) => [k, { type: "string" as const }]),
  ),
});
const action = positionals[0];
const required = (name: string) => {
  const v = values[name];
  if (!v) throw new Error(`Missing --${name}`);
  return v;
};
async function run() {
  if (action === "inspect") {
    const rows = csvRecords(await readFile(required("file"), "utf8"));
    console.log("CSV columns:", Object.keys(rows[0] || {}));
    console.log("Rows:", rows.length);
    return;
  }
  if (action === "import") {
    const region = regions.find((r) => r.id === required("region"));
    if (!region) throw Error("Unknown registry region");
    const scaled = required("scaled");
    if (!["true", "false"].includes(scaled))
      throw Error(
        "--scaled must explicitly be true or false after checking export metadata",
      );
    const series = importCSV(
      await readFile(required("file"), "utf8"),
      {
        date: required("date-column"),
        qa: required("qa-column"),
        ndvi: values["ndvi-column"],
        evi: values["evi-column"],
        latitude: required("latitude-column"),
        longitude: required("longitude-column"),
      },
      region.center,
    ).map((s) => ({ ...s, region: region.id, scaled: scaled === "true" }));
    const out = resolve(values.out || "data/vegetation.json");
    let previous: z.infer<typeof datasetSchema> | null = null;
    try {
      previous = datasetSchema.parse(JSON.parse(await readFile(out, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const taskId = required("task");
    const retrievedAt = new Date().toISOString();
    const provenance = {
      taskId,
      retrievedAt,
      processingNotes: required("notes"),
    };
    const dataset = datasetSchema.parse({
      source: "MOD13Q1.061",
      provenance,
      series: [
        ...(previous?.series || [])
          .filter(
            (s) =>
              !series.some((n) => n.region === s.region && n.index === s.index),
          )
          .map((s) => ({
            ...s,
            provenance: s.provenance || previous!.provenance,
          })),
        ...series.map((s) => ({ ...s, provenance })),
      ],
    });
    await mkdir(resolve(out, ".."), { recursive: true });
    await writeFile(`${out}.tmp`, JSON.stringify(dataset, null, 2));
    const { rename } = await import("node:fs/promises");
    await rename(`${out}.tmp`, out);
    console.log("Saved validated normalized dataset:", out);
    for (const s of series)
      console.log(s.index, coverage(s.observations, s.scaled));
    return;
  }
  if (!["submit", "status", "download"].includes(action))
    throw Error(
      "Use: submit, status, download, inspect or import. See docs/MODIS_WORKFLOW.md.",
    );
  const token = await appeearsToken();
  if (action === "submit") {
    const region = regions.find((r) => r.id === required("region"));
    if (!region) throw Error("Unknown registry region");
    const year = z.coerce.number().int().min(2001).max(2024);
    const start = year.parse(required("start")),
      end = year.parse(required("end"));
    if (start > end) throw Error("Start year must precede end year");
    const task = await submitPoint(
      token,
      region.center[0],
      region.center[1],
      `01-01-${start}`,
      `12-31-${end}`,
    );
    console.log("Submitted:", task);
    console.log("Save this task ID. Use status; do not submit duplicates.");
    return;
  }
  const id = required("task");
  const task = await taskStatus(token, id);
  console.log("Task status:", task.status);
  if (action === "status") return;
  if (task.status !== "done")
    throw Error("Task is not done. Poll status later; no files downloaded.");
  const files = z
    .object({
      files: z
        .array(
          z.object({
            file_id: z.string(),
            file_name: z.string(),
            file_size: z.number().max(20_000_000),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          }),
        )
        .max(100),
    })
    .parse(await bundle(token, id)).files;
  const out = resolve(values.out || `.terrascope/${id}`);
  await mkdir(out, { recursive: true });
  for (const file of files) {
    if (!/\.(csv|xml|json|txt|md)$/i.test(file.file_name)) continue;
    const name = file.file_name.split(/[\\/]/).at(-1)!;
    if (!name || name === "." || name === "..")
      throw Error("Invalid provider filename");
    const bytes = await downloadFile(token, id, file.file_id);
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw Error("Download checksum mismatch");
    await writeFile(join(out, name), bytes);
    console.log("Downloaded and verified:", name);
  }
}
run().catch((error) => {
  console.error(
    "MODIS workflow failed:",
    error instanceof Error ? error.message : "Unexpected error",
  );
  process.exitCode = 1;
});
