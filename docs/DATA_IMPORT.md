# Import a MODIS study-point dataset

This is a normalization contract, not an invented AppEEARS CSV schema. Obtain the actual task output, inspect its header and metadata, and map its NDVI/EVI and DetailedQA columns into the following structure. Never use the structural example below as measurements.

```json
{
  "source": "MOD13Q1.061",
  "provenance": {
    "taskId": "YOUR-ACTUAL-APPEEARS-TASK-ID",
    "retrievedAt": "2026-10-10T00:00:00Z",
    "processingNotes": "Document actual coordinates, downloaded file names, scaling, QA and any aggregation here."
  },
  "series": [
    {
      "region": "bangladesh",
      "index": "NDVI",
      "scaled": false,
      "observations": []
    }
  ]
}
```

Each observation is `{ "date": "YYYY-MM-DD", "value": <actual value>, "qa": <actual DetailedQA integer> }`. The QA field is the bit-packed VI_Quality layer, not the pixel reliability code. Record each point separately; do not mix raw pixels or multiple coordinates under a shared date. The analysis engine deduplicates dates for a single location. `scaled=false` multiplies raw MODIS values by 0.0001; `scaled=true` is only for verified already-scaled exports. Do not apply the scale twice.

Use `NDVI` or `EVI` and registry IDs `bangladesh`, `assam`, `chiang-mai`, `riyadh`. Duplicate region/index series are not supported. Limit: 8 series, 20,000 observations each. Quality and range filtering happens on the server before exposing observations. The operator is responsible for ensuring the declared source, coordinates and provenance match actual NASA output; schema validation cannot authenticate scientific provenance.

See [the operator workflow](MODIS_WORKFLOW.md) for CSV import commands. Use reviewed, non-secret `data/vegetation.json` for the default bundled deployment, server-only `VEGETATION_DATA_URL` for public HTTPS object storage, or local `VEGETATION_DATA_PATH` for an absolute local path. Restart/redeploy and leave data mode set to measured. Visit `/api/vegetation` to inspect availability. The dashboard updates charts, seasonal means, comparison series, uncertainty where eligible, measured point layers and descriptive slope from filtered records. The AI endpoint independently loads and calculates its selected summary on the server; it does not trust browser-supplied statistics.

For Vercel, `next.config.ts` explicitly includes `data/vegetation.json` in vegetation and scientist function traces. Do not use a Windows absolute path there. A public HTTPS object URL is also supported (8 MB limit, one-hour revalidation). Do not put credentials in the dataset. No live MODIS dataset is supplied with this repository. Per-series provenance is retained on subsequent imports; legacy series inherit the top-level provenance.
