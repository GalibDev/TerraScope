# Sentinel-2 detailed pilot

Separate from the MODIS long-term analysis: January 2020 versus January 2024, same analyst-defined Sundarbans East window [89.72,21.90,89.84,22.00]. Source: Copernicus Sentinel-2 Collection-1 L2A public COGs through Element 84 Earth Search. Data attribution: contains modified Copernicus Sentinel data (2020, 2024). Catalog and per-asset source metadata are included in public/data/sentinel2/manifest.json.

Rebuild with the raster requirements environment:
`.terrascope/raster-env/Scripts/python.exe scripts/process_sentinel2.py`

Choose the three lowest scene-cloud January scenes per period, tile MGRS-45QYE, scene cloud below 10%. Scene cloud is a prefilter, not local clear coverage. Apply per-pixel SCL 4/5 to NDVI, 4/5/6 to RGB, requiring at least two observations per pixel in each period. The 20 m SCL mask is nearest-resampled onto the common native 10 m UTM 45N grid. Apply each Collection-1 asset's reflectance scale and offset once, then compute NDVI for each scene and its period median. Output only paired land NDVI for before/after/change. RGB composites retain clear water for geographic context, so visible RGB does not guarantee paired NDVI. Same RGB stretch 0–0.3 and gamma 1.4 on both sides. No synthesized observations or gap filling.

The older sentinel-2-l2a catalog was rejected during development because asset offset metadata and physically offset COG values disagreed. Collection-1 is used for all published results; no exploratory 2019 outputs are published.

Measured output: 1,264,500 paired native cells / 1,427,452 footprint cells = 88.6%; mean paired NDVI change -0.0708. Coverage denominator includes water and padding. This comparison uses different periods, screening and aggregation than MODIS; coverage and change cannot be compared directly to MODIS. This is not a forest-loss estimate, tree count or significance test. Aerosol, haze, tide, sensor geometry and shoreline changes remain potential confounders; this is not a multi-year trend.

Native scientific GeoTIFFs retain EPSG:32645 and 10 m pixels; Web Mercator display uses nearest neighbour at approximately 10 m ground spacing. Binary display grids are little-endian Float32, NaN for missing data. The viewer loads them only on request. Integration tests verify paired masking, before/after subtraction, coverage counts, image-alpha/grid alignment, and matching scene months.
