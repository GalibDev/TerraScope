# Earthdata → TerraScope → Vercel

The browser never submits AppEEARS jobs. Run the operator CLI locally with Node 22.10+ after creating an [Earthdata Login](https://urs.earthdata.nasa.gov/) account, signing into [AppEEARS](https://appeears.earthdatacloud.nasa.gov/), and completing its account requirements. Authentication cannot be tested until an account exists. Do not send credentials in chat or commit them.

1. Copy `.env.example` to `.env.local`; set `NASA_EARTHDATA_USERNAME` and `NASA_EARTHDATA_PASSWORD` locally.
2. Submit **one representative location**:

```sh
npm run modis -- submit --region bangladesh --start 2001 --end 2024
```

Save the returned task ID. Do not repeatedly submit the same job. Other registry IDs: `assam`, `chiang-mai`, `riyadh`.

3. Check and download when done:

```sh
npm run modis -- status --task YOUR_TASK_ID
npm run modis -- download --task YOUR_TASK_ID
```

Downloads are sequential, limited to 20 MB per file, SHA-256 verified against the bundle manifest and stored under ignored `.terrascope/YOUR_TASK_ID/`. The CLI does not run an unbounded polling loop; pending/processing jobs should be checked later. Expired jobs or login tokens require another login/run; completed output retention is controlled by AppEEARS.

4. Inspect the downloaded product CSV header:

```sh
npm run modis -- inspect --file "PATH_TO_ACTUAL_RESULTS.csv"
```

Check the downloaded metadata/README for whether values are already scaled. Map the **actual** column names; the following is a template with placeholders, not a promise that AppEEARS uses these names:

```sh
npm run modis -- import --file "PATH_TO_ACTUAL_RESULTS.csv" --region bangladesh --task YOUR_TASK_ID --date-column "ACTUAL_DATE_HEADER" --qa-column "ACTUAL_DETAILED_QA_HEADER" --ndvi-column "ACTUAL_NDVI_HEADER" --evi-column "ACTUAL_EVI_HEADER" --latitude-column "ACTUAL_LATITUDE_HEADER" --longitude-column "ACTUAL_LONGITUDE_HEADER" --scaled true --notes "Describe verified export scaling, actual task, coordinates and original file names."
```

Use `--scaled false` for raw integers and `true` only for verified scaled values. The date parser accepts ISO YYYY-MM-DD or documented task-style MM-DD-YYYY dates. The input must contain a single registered coordinate (0.001° coordinate tolerance), not multiple points silently merged by timestamp. Blank VI/QA fields are missing, not zero. The QA column must be the bit-packed `_250m_16_days_VI_Quality`, not pixel reliability or a decoded text label. At least one index mapping is required; either NDVI or EVI may be imported independently.

The importer validates and atomically merges normalized series into `data/vegetation.json`, retaining other region/index series and their provenance. The server applies strict QA/scaling and returns import coverage statistics. Existing valid observations are deduplicated by date. Keep original downloaded metadata so future reviewers can reproduce the normalization.

5. Deploy measured results:

- For the simplest Vercel setup, commit the **reviewed, non-secret NASA-derived** `data/vegetation.json`, push and redeploy. `next.config.ts` includes it in vegetation and scientist function traces. Do not commit `.env.local` or raw account records.
- Alternatively host the normalized JSON on an approved public HTTPS object URL and set **server-only** `VEGETATION_DATA_URL` in Vercel; reads are validated, size limited to 8 MB and cached for one hour. Never place a signed credential URL in client code.
- Local `VEGETATION_DATA_PATH` is optional. A Windows absolute path does not exist inside Vercel; leave it unset there for bundled data.
- Earthdata username/password are only needed on the extraction machine. They are not needed by a Vercel site serving a processed dataset.
- Optional AI variables on Vercel: `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`. Keep them server-only. Without a key, useful deterministic scientific explanations still work.

## Spatial limitations

This workflow extracts points; it cannot produce country averages or land-area greening percentages. Bangladesh's included geoBoundaries gbOpen ADM0 outline is geographic context only, sourced from geoBoundaries/Wikimedia, representing 2015, CC0. It is not claimed to be an official legal boundary. An official boundary, area extraction, documented projection and resampling, area-weighted quality-filtered pixel processing and reproducible raster tiling are still needed for regional spatial inference.

The AppEEARS projection metadata lists MODIS under `sinu_modis`; `geographic` is not advertised for the Terra MODIS platform. Do not force an unverified geographic extraction configuration. Use documented supported projections and inspect actual output georeferencing before implementing raster processing. The current map only renders true-color imagery, the sourced outline, and measured point means when they exist.

Official references: [AppEEARS API](https://appeears.earthdatacloud.nasa.gov/api/), [MODIS vegetation product](https://modis.gsfc.nasa.gov/data/dataprod/mod13.php), [geoBoundaries API](https://www.geoboundaries.org/api.html). CLI request shape, auth and download paths are covered by mocked tests; private authenticated operations remain unverified.
