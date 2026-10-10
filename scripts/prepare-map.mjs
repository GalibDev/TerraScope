import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public", { recursive: true });
await copyFile(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/maplibre-worker.mjs",
);
