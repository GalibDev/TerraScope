# Verification — 2026-10-10

- 17 Vitest tests: scaling, raw/scaled handling, fill/range filtering, DetailedQA, timestamps, deduplication, aggregation, annual slope, insufficient evidence, seasonal and anomaly missing baselines, region registry, dataset import/provenance, unavailable providers, malformed responses and scientist fallback.
- TypeScript, ESLint and Next.js production build checked.
- Production smoke checks: dashboard HTTP 200, measured-data setup response, scientist reference response, NASA POWER 2023 Bangladesh response with T2M °C and PRECTOTCORR mm/day.
- Live MOD13Q1.061 product metadata retrieved and archived in the repository. Private Earthdata authentication, task submission and bundle operations were not exercised.
- GIBS tile HEAD returned HTTP 200. Browser rendering exposed a MapLibre worker issue; fixed by serving the installed version's worker from `/maplibre-worker.mjs`. Worker copied during `npm ci` postinstall.
- Browser checks: default narrow/mobile layout and 1440×1000 desktop layout; illustrative toggle; region and index updates; scientist fallback; real POWER temperature results; satellite map rendering. Screenshot shows explicit synthetic mode.
- Production dependency audit: no vulnerabilities. Full development dependency audit reports five high findings through ESLint's glob/braces chain; npm's proposed remediation downgrades eslint-config-next across major versions and was not applied automatically.

Not verified: LLM with a private key, authenticated AppEEARS task lifecycle, a real operator-imported MODIS dataset (import tested with labeled synthetic fixtures only), deployment, complete 2026 challenge-specific compliance. There is no measured regional raster, spatial greening-area estimate or dependence-aware significance inference.
