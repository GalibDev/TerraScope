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

## Additional measured study points imported 2026-11-09

Completed AppEEARS tasks for Assam, Chiang Mai and Riyadh were downloaded using the existing checksum-verifying CLI. Provider README section 3 confirms scaled point values; registry coordinates were validated during import. NDVI and EVI retain original dates and bit-packed VI Quality, with unchanged strict server QA. Existing Bangladesh observations and per-series provenance are preserved.

| Study point | Task ID | Source records per index | Valid records in 2001–2024 | Observed months in 2001–2024 |
| --- | --- | --- | --- | --- |
| Assam | 0e114512-d1cd-41ac-9945-fb9d4fc8372d | 553 | 161 | 131/288 |
| Chiang Mai | c99eeb3c-d73b-4bfd-927a-466faa880fee | 553 | 106 | 79/288 |
| Riyadh | 359e09fa-ee95-4e04-8f64-36df5457c4c3 | 553 | 534 | 286/288 |

Source CSV SHA-256:
- Assam: e3aa354b62c3765cb3729a7e73ef974ff3f8619d3e351d9ae7172fc0f98c055a
- Chiang Mai: 7e71b99e50c19476242301c26d7a0f763a377cec60079db551fa6ebca20b9f2d
- Riyadh: 49c91bfcd8830dbf149486c24393ee0ce46f35fee6fe9eb0619de4efc562c4a2

The full source includes an overlapping 2000-12-18 composite, excluded by the dashboard's 2001–2024 period filter. Both indices have the same retained record counts. Assam and Chiang Mai have no complete calendar years under strict QA. Riyadh has 22 complete calendar years, but the engine still classifies the selected series as insufficient for its uncertainty requirements; record availability must not be presented as a supported directional trend. All locations are representative study points, not regional averages. This section supersedes the earlier processing status for these three tasks.
