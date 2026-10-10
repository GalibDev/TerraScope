import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  appeearsToken,
  nasaFetch,
  product,
  taskStatus,
  bundle,
  downloadFile,
} from "../lib/nasa";
const root = ".terrascope/sundarbans";
const config = JSON.parse(
  await readFile("data/studies/sundarbans.json", "utf8"),
);
await mkdir(root, { recursive: true });
const registryPath = join(root, "tasks.json");
let tasks: Record<string, string> = {};
try {
  tasks = JSON.parse(await readFile(registryPath, "utf8"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const action = process.argv[2];
if (!["submit", "status", "download"].includes(action))
  throw Error("Use submit, status or download");
const token = await appeearsToken();
for (const [period, years] of Object.entries(config.periods) as [
  string,
  number[],
][]) {
  if (action === "submit" && !tasks[period]) {
    const meta = await product();
    const layers = ["_250m_16_days_NDVI", "_250m_16_days_VI_Quality"];
    if (layers.some((l) => !meta[l]?.Available))
      throw Error("Required layers unavailable");
    const projections = await (
      await nasaFetch(
        "https://appeears.earthdatacloud.nasa.gov/api/spatial/proj",
      )
    ).json();
    if (
      !projections.some(
        (p: { Name: string; Available: boolean; Platforms: string }) =>
          p.Name === config.projection &&
          p.Available &&
          p.Platforms.includes("Terra MODIS"),
      )
    )
      throw Error("Unsupported MODIS projection");
    const [w, s, e, n] = config.bbox;
    const request = {
      task_type: "area",
      task_name: `TerraScope Sundarbans ${period}`,
      params: {
        dates: [
          {
            startDate: "01-01",
            endDate: "02-28",
            recurring: true,
            yearRange: years,
          },
          {
            startDate: "11-01",
            endDate: "12-31",
            recurring: true,
            yearRange: years,
          },
        ],
        layers: layers.map((layer) => ({ product: config.product, layer })),
        geo: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: config.id },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [w, s],
                    [e, s],
                    [e, n],
                    [w, n],
                    [w, s],
                  ],
                ],
              },
            },
          ],
        },
        output: {
          format: { type: "geotiff", filename_date: "calendar" },
          projection: config.projection,
        },
      },
    };
    await writeFile(
      join(root, `${period}-request.json`),
      JSON.stringify(request, null, 2),
    );
    const result = await (
      await nasaFetch("https://appeears.earthdatacloud.nasa.gov/api/task", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })
    ).json();
    if (!result.task_id) throw Error("NASA did not return a task ID");
    tasks[period] = result.task_id;
    await writeFile(registryPath, JSON.stringify(tasks, null, 2));
  }
  if (!tasks[period]) {
    console.log(period, "not submitted");
    continue;
  }
  const t = await taskStatus(token, tasks[period]);
  console.log(period, t.status);
  if (action !== "download" || t.status !== "done") continue;
  const manifest = await bundle(token, tasks[period]);
  if (!Array.isArray(manifest.files) || manifest.files.length > 1000)
    throw Error("Unexpected bundle manifest");
  const dir = join(root, period);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "bundle.json"), JSON.stringify(manifest, null, 2));
  const files = manifest.files.filter((f: { file_name: string }) =>
    /\.(tif|tiff|xml|json|txt|md)$/i.test(f.file_name),
  );
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < files.length) {
        const f = files[cursor++];
        const name = f.file_name.split(/[\\/]/).at(-1);
        if (
          !name ||
          name === ".." ||
          f.file_size > 20_000_000 ||
          !/^[a-f0-9]{64}$/.test(f.sha256)
        )
          throw Error("Unsafe bundle entry");
        const path = join(dir, name);
        try {
          const old = await readFile(path);
          if (createHash("sha256").update(old).digest("hex") === f.sha256)
            continue;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        const bytes = await downloadFile(token, tasks[period], f.file_id);
        if (createHash("sha256").update(bytes).digest("hex") !== f.sha256)
          throw Error("Checksum mismatch");
        await writeFile(path, bytes);
      }
    }),
  );
  console.log(period, "verified files:", files.length);
}
