# Verification — 2026-10-10

- 36 Vitest tests: scaling, raw/scaled handling, fill/range filtering, DetailedQA, timestamps, deduplication, aggregation, annual slope, independent NumPy-reference HAC covariance and interval, uncertainty-based classification, consecutive-year requirements, seasonal and anomaly missing baselines, region registry, dataset import/provenance, explicit CSV mapping, measured point-map values, unavailable providers, malformed responses and scientist fallback. AppEEARS login/task/bundle paths are mocked, not real authenticated verification.
- TypeScript, ESLint and Next.js production build checked.
- Production smoke checks: dashboard HTTP 200, measured-data setup response, scientist reference response, NASA POWER 2023 Bangladesh response with T2M °C and PRECTOTCORR mm/day.
- Live MOD13Q1.061 product metadata retrieved and archived in the repository. Private Earthdata authentication, task submission and bundle operations were not exercised.
- GIBS tile HEAD returned HTTP 200. Browser rendering exposed a MapLibre worker issue; fixed by serving the installed version's worker from `/maplibre-worker.mjs`. Worker copied during `npm ci` postinstall.
- Browser checks: default narrow/mobile layout and 1440×1000 desktop layout; illustrative toggle; region and index updates; scientist fallback; real POWER temperature results; satellite map rendering. Screenshot shows explicit synthetic mode.
- Production dependency audit: no vulnerabilities. Full development dependency audit reports five high findings through ESLint's glob/braces chain; npm's proposed remediation downgrades eslint-config-next across major versions and was not applied automatically.

- Operator CLI smoke check: inspect and import of a labeled synthetic CSV into ignored `.terrascope/test/vegetation.json` retained one QA-valid observation per index and excluded a poor-quality record. No synthetic file was written to deployment data.
- Vercel file-tracing build warning was fixed by separating static bundled loading from ignored dynamic local-file access. Default bundled data and optional public HTTPS loading are implemented.

Not verified: LLM with a private key, authenticated AppEEARS task lifecycle, a real operator-imported MODIS dataset (import tested with labeled synthetic fixtures only), deployment, complete 2026 challenge-specific compliance. There is no measured regional raster or spatial greening-area estimate. HAC uncertainty is conditional and approximate; see STATISTICS.md. The official challenge details still could not be retrieved reliably; staging content was inconsistent and was not treated as an authoritative brief.
