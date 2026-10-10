# Sundarbans East pilot comparison

The study is an analyst-defined rectangle [89.72,21.90,89.84,22.00] around the UNESCO-listed Sundarbans East location. It is not an official sanctuary polygon, the entire Sundarbans, or a country-wide forest estimate. Location reference: https://whc.unesco.org/en/list/0798/maps/ . The three listed World Heritage components are distinct from the larger mangrove region.

## Extraction

Use the existing local Earthdata credentials; never publish them. Node 22.10+:

```
npm run sundarbans -- submit
npm run sundarbans -- status
npm run sundarbans -- download
```

Submission persists one task per period in ignored `.terrascope/sundarbans/tasks.json`, reusing IDs on subsequent calls. Do not delete this registry to retry a pending job. The dates select Jan 1–Feb 28 and Nov 1–Dec 31, recurring over 2001–2005 and 2020–2024. These are calendar-year seasonal-month averages, not five contiguous cross-year winters. Source product is MOD13Q1.061 NDVI and bit-packed VI_Quality; output GeoTIFF, supported Terra MODIS `sinu_modis` projection, calendar filenames. Availability is checked before submission. Downloads require completed tasks, are resumable with SHA-256 verification, bounded to 20 MB/file and four concurrent transfers, and stored locally. Official API: https://appeears.earthdatacloud.nasa.gov/api/ .

## Processing

Create a Python virtual environment, then install `scripts/raster-requirements.txt`. The extraction environment does not run on Vercel.

```
python -m pip install -r scripts/raster-requirements.txt
python tests/test_raster.py
python scripts/process_sundarbans.py
```

Inspect actual GeoTIFF metadata before publication. The processor accepts raw integer NDVI, multiplies by 0.0001, and rejects unexpected float exports rather than silently double-scaling. VI/QA and all temporal native grids must match exactly. QA requires good MODLAND, usefulness <=2, aerosol <=1, no adjacent/mixed cloud/snow/shadow, and land mask=1. Missing/fill/out-of-range values are excluded.

Monthly means use valid composites. A seasonal-year mean requires all four months; each period needs >=3 of its five complete seasonal years per pixel. Months and years have equal weights. Only pixels meeting both periods are published. Water/insufficient data is transparent. No gaps are interpolated. No significance or forest-loss inference is made. Tides, shoreline changes, mixed pixels and unequal valid-year subsets can affect comparisons.

The before/after/change scientific GeoTIFFs retain the native equal-area grid. A small 250 m Web Mercator display grid uses nearest-neighbour reprojection for browser alignment; transparent PNGs, coordinates and sampled values are saved under `public/data/sundarbans/`. Mean change and paired coverage are calculated on native paired pixels. Values are not interpreted as national statistics. Legend colors saturate beyond ±0.30 change while pixel values and scientific downloads preserve full differences. This bounded pilot uses small georeferenced images rather than a national tile pyramid. Larger extents require a tiled storage workflow.

After validating measured outputs, commit public output assets and redeploy. A processing-only manifest is shipped until both NASA jobs finish and the processor succeeds. No synthetic raster is shipped.

## Verification

Five Python scientific tests cover land/cloud/fill masking, equal-month/year weighting, the complete-season minimum, and transparent missing pixels. A separate ignored synthetic end-to-end GeoTIFF smoke test produced 90/100 paired pixels and exactly +0.1000 mean change. The local viewer displayed before 0.5000, after 0.6000 and change 0.1000 on pixel selection, and the change toggle rendered without browser warnings. Synthetic fixture assets were isolated behind a local test proxy and never copied to deployment assets. Real measured outputs are documented below; the synthetic test remains isolated.
## Measured release and QA sensitivity

Both NASA jobs completed and 86 files per period were downloaded with provider checksums verified. Task IDs: before b76857aa-9266-439c-8731-50864c4def39; after 6200d963-e380-40dc-ac38-dd7633486564. Real GeoTIFF inspection confirmed int16 raw values, -3000 fill, 0.0001 scale, zero offset and native MODIS sinusoidal projection.

The initial strict policy produced **zero paired pixels** meeting the seasonal-year minimum: recent land observations are frequently MODLAND=1 with intermediate aerosol. This is an observed QA sensitivity, not evidence of absence of vegetation. To permit an explicitly exploratory view, a separate `--qa-policy screened` policy was implemented. It permits MODLAND=0/1 only when usefulness<=2, aerosol<=2, all cloud/snow/shadow flags pass and land mask=1. It still excludes high aerosol, cloudy/not-produced MODLAND codes, water and insufficient seasonal years. This policy is an analyst choice, not a NASA-prescribed confidence threshold. Point dashboard QA remains unchanged.

QA definitions are taken from the official MOD13 Collection 6.1 user guide, Table 5: https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf . Code 01 means produced but check other QA; aerosol code 10 means intermediate. Do not call these records highest-quality or claim validation accuracy for low-aerosol observations applies to them.

The published exploratory raster was built with:

```
python scripts/process_sundarbans.py --qa-policy screened
```

It contains 304 paired native pixels out of a 4067-cell rectangular native grid footprint (7.5%, including excluded water and padding); descriptive mean change +0.0278 NDVI. This is not 7.5% of the forest or sanctuary. All four seasonal months and >=3 complete seasonal years per period are still required. Pixel readouts include each period's retained seasonal-year count. Strict paired coverage=0 is prominently disclosed in the viewer and recorded in the manifest. Consequently the difference is not robust to QA policy, cannot establish significant greening, and cannot be interpreted as tree gain/loss. The small spatially incomplete sample is not representative of the whole Sundarbans.

Five Python tests now include explicit screened-versus-strict handling. Earlier processing-only statements above describe the initial workflow state; the published manifest records the completed measured release.

Real browser verification: before/after divider and change toggle rendered without warnings. A selected pixel returned before 0.7898, after 0.8106, change +0.0208, with 5/5 and 4/5 complete seasonal years respectively. Desktop and narrow-layout navigation checked; screenshot saved in sundarbans-preview.png.
