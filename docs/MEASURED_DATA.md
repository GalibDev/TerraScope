# Measured Bangladesh study point — 2026-10-10

- Source: NASA AppEEARS, MOD13Q1.061; NDVI, EVI and bit-packed DetailedQA.
- Task: 76e26ced-6dc8-4c0a-9d59-d600ba1fe617; authenticated submission, completion and bundle download verified.
- Point: latitude 23.685, longitude 90.3563. This is not a Bangladesh spatial mean.
- Requested interval: 2001-01-01 through 2024-12-31. Provider supplied 553 records, including one overlapping composite dated 2000-12-18. Original dates are preserved; dashboard period filtering excludes that composite for 2001–2024 views.
- Original CSV: TerraScope-study-point-MOD13Q1-061-results.csv; SHA-256 9813344e55f5a93a2196e3b028c54f7d7413ae3d5b530b3928b4f6a8b5dc4479. Downloads were checked against provider bundle SHA-256 manifests.
- Provider bundle README section 3 confirms scaled extracted pixel values. Imported with scaled=true; no second 0.0001 scaling. QA uses the original numeric VI_Quality column, not a decoded label.
- Strict QA retains 147 records per index across the full source (406 excluded); 146 records fall in the selected 2001–2024 interval. Full source represents 113 months, including December 2000. Selected period has incomplete monthly/yearly coverage; no complete annual trend or significance claim is supported.
- Normalized source observations and provenance are bundled in data/vegetation.json. Raw account/request metadata and credentials remain local and ignored.
- Assam, Chiang Mai and Riyadh extraction tasks were still processing when this dataset was imported.

Earlier setup-only/private-operation statements in VERIFICATION.md describe pre-account checks. This record supersedes them for this Bangladesh point; regional raster and area-weighted results remain unimplemented.
