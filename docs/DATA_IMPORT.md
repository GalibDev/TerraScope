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

Store the actual file outside tracked source or in an appropriate deployment data directory. Set `VEGETATION_DATA_PATH` in `.env.local` to its absolute path. Restart the app and leave data mode set to measured. Visit `/api/vegetation` to inspect availability. The dashboard updates charts, seasonal means, comparison series and descriptive slope from the filtered records. The AI endpoint independently loads and calculates its selected summary on the server; it does not trust browser-supplied statistics.

For Vercel, use an included non-secret licensed data file and a path relative to the deployment's working directory, and verify file tracing includes it, or adapt `loadDataset` to an approved object store. Do not put credentials in the dataset. No live MODIS dataset is supplied with this repository.
