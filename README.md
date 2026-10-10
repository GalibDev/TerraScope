# TerraScope — Bangladesh to the World

Discover where Earth is greening — and where it is losing green.

An independent NASA Space Apps project exploring: where is vegetation changing in Bangladesh, and how do selected global locations compare? This repository contains a working scientific dashboard with interactive NASA imagery, regional controls, transparent synthetic exploration, supporting climate access and a server-side scientific assistant. It does not yet contain a validated regional MODIS dataset. It does not claim NASA endorsement.

## Run locally

Node.js 22+ and npm:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell: `Copy-Item .env.example .env.local`. Open http://localhost:3000. No credentials are needed for the interface, GIBS imagery or POWER. Use the data mode toggle to explore explicitly synthetic charts. Exported CSVs also identify synthetic data. Measured mode truthfully shows unavailable states.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

## Architecture

Next.js App Router, React, TypeScript, custom responsive CSS, Recharts, MapLibre, Zod and Vitest. `lib/analysis.ts` separates preparation, aggregation, descriptive trends, seasonality and anomalies. `lib/nasa.ts` contains protected AppEEARS adapters. `app/api/climate` requests POWER for registry locations only; `app/api/scientist` protects the optional LLM key. `app/api/vegetation` reports setup required. No database is necessary for this foundation.

## Sources and provenance

- [MODIS MOD13 documentation](https://modis.gsfc.nasa.gov/data/dataprod/mod13.php): MOD13Q1.061, Terra, nominal 250 m, 16-day composites, observations since 2000. [Earthdata discovery](https://search.earthdata.nasa.gov/search?q=MOD13Q1).
- [AppEEARS API](https://appeears.earthdatacloud.nasa.gov/api/): metadata retrieved on 2026-10-10 and saved in `modis-metadata.json`. Verified available layers: `_250m_16_days_NDVI`, `_250m_16_days_EVI`, `_250m_16_days_VI_Quality`. Raw NDVI/EVI scale: 0.0001, fill: −3000, valid raw range −2000 to 10000. AppEEARS outputs may already be scaled: explicitly pass `scaled=true` only when export metadata confirms this.
- [MODIS vegetation user guide](https://landweb.modaps.eosdis.nasa.gov/data/userguide/MODISC6VIUserguide.pdf): DetailedQA bit decoding. Strict filtering retains MODLAND=0, usefulness≤2, aerosol≤1 and excludes adjacent/mixed cloud, snow/ice and shadow. This conservative policy may reduce coverage substantially.
- [NASA POWER monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/): T2M and PRECTOTCORR, AG community, selected representative point. T2M is °C; precipitation is mean mm/day, not monthly total. Response units are preserved. −999 is missing. Annual month 13 is excluded from the temperature view. POWER describes a coarse climate grid, not 250 m observations.
- [GIBS access documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/): WMTS EPSG:3857, `MODIS_Terra_CorrectedReflectance_TrueColor`, `GoogleMapsCompatible_Level9`, JPEG. User-selected imagery date is separate from the analysis period. Imagery is geographic context, never an NDVI heatmap.

## Earthdata setup and remaining processing

Create an [Earthdata Login](https://urs.earthdata.nasa.gov/) account, sign into AppEEARS and accept applicable terms. Set server-only NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD. The adapter uses documented POST /login Basic authentication, then Bearer authorization. `submitPoint` verifies live product layers, submits a point task (dates use AppEEARS MM-DD-YYYY format), `taskStatus` polls a task and `bundle` lists result files. These authenticated operations have not been tested with private credentials. They are deliberately not exposed as a public task-creation endpoint to avoid abusing an owner's account.

An operator must submit selected study points, poll to completion, download the relevant CSVs from the returned bundle through AppEEARS, inspect scaling/QA fields, normalize to `{date,value,qa}`, run `prepare`, and retain provenance. Point extraction is not a country average. Regional results require official administrative boundaries, area-weighted pixel processing and coverage accounting. A normalized JSON import is supported via server-only VEGETATION_DATA_PATH; automatic bundle CSV conversion and analytical raster tiles remain future work. Do not replace missing results with synthetic data. The default dashboard is honest about these limitations.

## Statistical methodology

Invalid timestamps, nonfinite values, fill, poor QA and out-of-range measurements are discarded. Duplicate dates retain the first valid record (intended for a single location series, not unaggregated pixels). Monthly means use available valid records; gaps are not interpolated. OLS slopes are calculated from complete 12-month annual means, requiring ≥5 years. Units are index units/year. Complete-year filtering reduces seasonal composition bias; it does not eliminate autocorrelation, spatial sampling bias or changing QA coverage. Confidence intervals and p-values are intentionally unavailable until dependence-aware inference is implemented. Classification remains “No clear directional trend” even for positive descriptive slopes; fewer years yield “Insufficient data”. Supported greening/browning classification is pending that inference, not inferred from slope sign.

Seasonal profiles average each calendar month across selected years. The anomaly helper uses a fixed 2001–2010 calendar-month baseline, ≥5 baseline observations and sample standard deviation. |z|≥2 is a descriptive unusual-observation rule, not a disaster attribution or a calibrated significance test. Anomaly visualisation is pending. Synthetic tests use documented raw shapes and are never scientific observations.

Study registry: Bangladesh (23.6850,90.3563), Assam representative point (26.2006,92.9376), Chiang Mai city (18.7883,98.9853), Riyadh city (24.7136,46.6753). These are explicitly representative locations; no invented national polygons are displayed. Climate, crop cycles and land use differ, limiting comparisons. Mean indices are not forest area percentages.

## AI and reliability

Optional `AI_PROVIDER_API_KEY` and `AI_PROVIDER_MODEL` configure the OpenAI chat endpoint. Only questions and relevant server-calculated summaries from the configured validated dataset are sent; demo values are never represented as observations. Without configuration or on failure, the route provides a useful reference explanation. Data-dependent explanations require an operator-provided dataset. Remote operations time out after 20 seconds. Public metadata and climate requests use Next.js 24-hour cache revalidation. Private authentication is uncached. No arbitrary provider URLs or task submissions are accepted from browsers. Public deployment should add platform-level rate limiting for AI usage. The assistant includes a 20-request/minute per-instance backstop; distributed deployments still need platform rate protection.

## Competition alignment

The official [2026 challenge listing](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/) was located, but its detailed page returned HTTP 502 during verification. Full challenge-specific dataset and submission compliance remains unverified. MODIS vegetation plus climate is scientifically related to Earth-system trend exploration, but do not claim confirmed challenge compliance until the current brief is accessible and checked. The [official 2026 event page](https://www.spaceappschallenge.org/2026/) should govern participation and submission rules.

Demo workflow: open Bangladesh → select period/index → enable clearly labeled illustrative mode → inspect charts and descriptive slope → add comparison points → choose imagery date → load real POWER climate → ask the scientist → review methodology and sources. Disable demo to show the true measured-data availability state.

## Vercel deployment

Push the repository to GitHub, import it into Vercel, select Next.js, add optional server environment variables in project settings, and deploy. Build command `npm run build`; install command `npm ci`. Never put secrets in NEXT_PUBLIC variables. Configure usage limits/rate protection before exposing a paid AI key. No deployment has been performed by this repository setup.

## Troubleshooting and known limits

GIBS may lack a selected date or tiles may be cloudy; choose another date. WebGL is required for MapLibre. POWER may rate-limit or time out; the climate panel permits retry without blocking other panels. Caching follows deployment runtime semantics. Lack of private Earthdata credentials prevents end-to-end extraction verification. There are no regional measured results, confidence intervals, analytical raster overlays, country polygons or greening-area estimates. Current analysis years are 2001–2024, intentionally historical rather than claiming real-time coverage. Attribution: NASA MODIS, LP DAAC/AppEEARS, NASA POWER and NASA GIBS.

