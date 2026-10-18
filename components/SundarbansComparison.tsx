"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["processing", "available"]),
  study: z.object({
    name: z.string(),
    boundaryNote: z.string(),
    locationReference: z.url(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  coordinates: z
    .tuple([
      z.tuple([z.number(), z.number()]),
      z.tuple([z.number(), z.number()]),
      z.tuple([z.number(), z.number()]),
      z.tuple([z.number(), z.number()]),
    ])
    .optional(),
  displayBounds: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  grid: z
    .record(z.string(), z.array(z.array(z.number().nullable())))
    .optional(),
  images: z
    .object({ before: z.string(), after: z.string(), change: z.string() })
    .optional(),
  summary: z
    .object({
      pairedPixels: z.number(),
      nativePixels: z.number(),
      pairedCoveragePercent: z.number(),
      meanChange: z.number(),
    })
    .optional(),
  method: z.string().optional(),
  qaPolicy: z.enum(["strict", "screened"]).optional(),
  strictPairedPixels: z.number().int().nonnegative().optional(),
});
type Manifest = z.infer<typeof schema>;
export default function SundarbansComparison() {
  const [data, setData] = useState<Manifest | null>(null),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"compare" | "change">("compare"),
    [split, setSplit] = useState(50);
  const [sample, setSample] = useState<(number | null)[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);
  const baseEl = useRef<HTMLDivElement>(null),
    topEl = useRef<HTMLDivElement>(null);
  const maps = useRef<maplibregl.Map[]>([]);
  useEffect(() => {
    fetch("/data/sundarbans/manifest.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        const parsed = schema.parse(v);
        if (
          parsed.status === "available" &&
          (!parsed.grid ||
            !parsed.width ||
            !parsed.height ||
            !parsed.displayBounds ||
            !parsed.coordinates ||
            !parsed.images ||
            !parsed.summary ||
            Object.values(parsed.images).some(
              (url) => !url.startsWith("/data/sundarbans/"),
            ))
        )
          throw Error("Incomplete comparison");
        setData(parsed);
      })
      .catch(() =>
        setError("Comparison dataset could not be loaded. Please reload."),
      );
  }, []);
  useEffect(() => {
    if (
      data?.status !== "available" ||
      !data.images ||
      !data.coordinates ||
      !baseEl.current ||
      !topEl.current
    )
      return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    try {
      const style = (overlay: boolean): maplibregl.StyleSpecification => ({
        version: 8,
        sources: {
          selection: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          ...Object.fromEntries(
            Object.entries(data.images!).map(([name, url]) => [
              name,
              { type: "image", url, coordinates: data.coordinates! },
            ]),
          ),
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#E6E6DC" },
          },
          ...[overlay ? "after" : "before", ...(overlay ? [] : ["change"])].map(
            (name) => ({
              id: name,
              type: "raster" as const,
              source: name,
              layout: {
                visibility: (name === "change" ? "none" : "visible") as
                  "none" | "visible",
              },
              paint: {
                "raster-opacity": 1,
                "raster-resampling": "nearest" as const,
                "raster-fade-duration": 0,
              },
            }),
          ),
          {
            id: "selected-pixel",
            type: "line",
            source: "selection",
            paint: { "line-color": "#ffdf00", "line-width": 3 },
          },
        ],
      });
      const [w, s, e, n] = data.study.bbox;
      const base = new maplibregl.Map({
        container: baseEl.current,
        style: style(false),
        bounds: [
          [w, s],
          [e, n],
        ],
        fitBoundsOptions: { padding: 20 },
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
        attributionControl: { compact: true },
      });
      maps.current.push(base);
      base.touchZoomRotate.disableRotation();
      const top = new maplibregl.Map({
        container: topEl.current,
        style: style(true),
        center: base.getCenter(),
        zoom: base.getZoom(),
        interactive: false,
        attributionControl: false,
      });
      maps.current.push(top);
      base.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      base.on("move", () =>
        top.jumpTo({
          center: base.getCenter(),
          zoom: base.getZoom(),
          bearing: base.getBearing(),
          pitch: base.getPitch(),
        }),
      );
      const resize = new ResizeObserver(() => {
        base.resize();
        top.resize();
        top.jumpTo({ center: base.getCenter(), zoom: base.getZoom() });
      });
      resize.observe(baseEl.current);
      base.on("click", (ev) => {
        const x = (6378137 * ev.lngLat.lng * Math.PI) / 180,
          y =
            6378137 *
            Math.log(Math.tan(Math.PI / 4 + (ev.lngLat.lat * Math.PI) / 360));
        const [left, bottom, right, topBound] = data.displayBounds!;
        const col = Math.floor(((x - left) / (right - left)) * data.width!),
          row = Math.floor(
            ((topBound - y) / (topBound - bottom)) * data.height!,
          );
        if (col < 0 || row < 0 || col >= data.width! || row >= data.height!) {
          setCell(null);
          setSample([null, null, null, null, null]);
          for (const m of maps.current)
            (m.getSource("selection") as maplibregl.GeoJSONSource)?.setData({
              type: "FeatureCollection",
              features: [],
            });
          return;
        }
        setCell({ row, col });
        const dx = (right - left) / data.width!,
          dy = (topBound - bottom) / data.height!;
        const toLngLat = (px: number, py: number) => [
          ((px / 6378137) * 180) / Math.PI,
          ((2 * Math.atan(Math.exp(py / 6378137)) - Math.PI / 2) * 180) /
            Math.PI,
        ];
        const x0 = left + col * dx,
          y0 = topBound - row * dy;
        const ring = [
          [x0, y0],
          [x0 + dx, y0],
          [x0 + dx, y0 - dy],
          [x0, y0 - dy],
          [x0, y0],
        ].map(([px, py]) => toLngLat(px, py));
        for (const m of maps.current)
          (m.getSource("selection") as maplibregl.GeoJSONSource)?.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [ring] },
          });
        setSample(
          ["before", "after", "change", "beforeYears", "afterYears"].map(
            (k) => data.grid?.[k]?.[row]?.[col] ?? null,
          ),
        );
      });
      for (const m of maps.current)
        m.on("error", () =>
          setError(
            "Raster map could not render. Download the measured grids below.",
          ),
        );
      return () => {
        resize.disconnect();
        maps.current.forEach((m) => m.remove());
        maps.current = [];
      };
    } catch {
      maps.current.forEach((m) => m.remove());
      maps.current = [];
      queueMicrotask(() =>
        setError("WebGL map is unavailable on this device."),
      );
    }
  }, [data]);
  useEffect(() => {
    const base = maps.current[0];
    if (!base) return;
    if (selecting) base.dragPan.disable();
    else base.dragPan.enable();
    base.getCanvas().style.cursor = selecting ? "crosshair" : "";
  }, [selecting, data]);
  useEffect(() => {
    const base = maps.current[0];
    if (!base) return;
    const update = () => {
      for (const layer of ["before", "change"])
        if (base.getLayer(layer))
          base.setLayoutProperty(
            layer,
            "visibility",
            (layer === "change") === (mode === "change") ? "visible" : "none",
          );
    };
    if (base.isStyleLoaded()) update();
    else base.once("load", update);
    return () => {
      base.off("load", update);
    };
  }, [mode, data]);
  return (
    <section className="card sundarbans-card" id="sundarbans">
      <div className="card-heading">
        <div>
          <div className="eyebrow">SPATIAL COMPARISON · MOD13Q1.061</div>
          <h2>Sundarbans, then & now</h2>
          <p>2001–2005 versus 2020–2024 · Jan / Feb / Nov / Dec · NDVI</p>
        </div>
      </div>
      <div className="sundarbans-content">
        <p>
          {data?.study.boundaryNote || "Sundarbans East pilot study window."}
        </p>
        {error && (
          <p role="status" className="comparison-status">
            {error}
          </p>
        )}
        {data?.status !== "available" ? (
          <div className="comparison-pending">
            <b>
              {data
                ? "NASA area extraction is processing"
                : "Loading comparison status…"}
            </b>
            <p>
              The before/after raster has not been published yet. No synthetic
              vegetation map is shown.
            </p>
            <p>
              Two extraction windows are requested. Download, QA filtering and
              paired coverage checks must finish before measured results appear
              here.
            </p>
          </div>
        ) : (
          <>
            {data.qaPolicy === "screened" && (
              <p className="comparison-status">
                <b>Exploratory QA policy · not robust greening evidence.</b>{" "}
                This comparison includes intermediate-aerosol records after
                checking other quality flags. The strict low-aerosol policy
                retains {data.strictPairedPixels ?? 0} paired pixels. Results
                depend on QA choices; no statistical significance or
                forest-change claim is supported.
              </p>
            )}
            <div className="comparison-controls">
              <button
                className="secondary"
                aria-pressed={selecting}
                onClick={() => setSelecting(!selecting)}
              >
                {selecting ? "Done selecting" : "Select pixel"}
              </button>
              <button
                className="secondary"
                aria-pressed={mode === "compare"}
                onClick={() => setMode("compare")}
              >
                Before / after
              </button>
              <button
                className="secondary"
                aria-pressed={mode === "change"}
                onClick={() => setMode("change")}
              >
                NDVI change
              </button>
              <span>
                {selecting
                  ? "Click or tap one pixel · zoom in for precision"
                  : "Drag the divider · click a pixel for values"}
              </span>
            </div>
            <div className="comparison-map">
              <div
                ref={baseEl}
                className="comparison-canvas"
                aria-label="Measured Sundarbans NDVI comparison map"
              />
              <div
                ref={topEl}
                className="comparison-canvas comparison-overlay"
                aria-hidden="true"
                style={{
                  clipPath: `inset(0 0 0 ${split}%)`,
                  visibility: mode === "compare" ? "visible" : "hidden",
                }}
              />
              {mode === "compare" && (
                <>
                  <div
                    className="comparison-divider"
                    style={{ left: `${split}%` }}
                  />
                  <span className="comparison-label before">2001–2005</span>
                  <span className="comparison-label after">2020–2024</span>
                </>
              )}
              <div
                className="comparison-pixel-values"
                role="status"
                aria-label="Selected pixel values"
              >
                <b>{sample ? "Selected pixel · NDVI" : "Inspect a pixel"}</b>
                {cell && (
                  <p>
                    Display pixel · row {cell.row + 1}, column {cell.col + 1}
                  </p>
                )}
                {sample ? (
                  sample[0] !== null && sample[1] !== null ? (
                    <>
                      <dl>
                        <div>
                          <dt>Before · 2001–2005</dt>
                          <dd>{sample[0].toFixed(4)}</dd>
                        </div>
                        <div>
                          <dt>After · 2020–2024</dt>
                          <dd>{sample[1].toFixed(4)}</dd>
                        </div>
                        <div>
                          <dt>ΔNDVI · after − before</dt>
                          <dd>
                            {sample[2] == null
                              ? "Unavailable"
                              : `${sample[2] > 0 ? "+" : ""}${sample[2].toFixed(4)}`}
                          </dd>
                        </div>
                      </dl>
                      <small>
                        Complete seasonal years: {sample[3] ?? 0}/5 before ·{" "}
                        {sample[4] ?? 0}/5 after
                      </small>
                    </>
                  ) : (
                    <p>
                      No paired measurements at this location. Select a coloured
                      pixel; blank areas have insufficient data or were excluded
                      by QA.
                    </p>
                  )
                ) : (
                  <p>
                    Click or tap a coloured pixel to see its before, after and
                    change values here.
                  </p>
                )}
              </div>
            </div>
            {mode === "compare" && (
              <label className="comparison-slider">
                Before / after divider
                <input
                  aria-label="Before and after map divider"
                  type="range"
                  min="0"
                  max="100"
                  value={split}
                  onChange={(e) => setSplit(+e.target.value)}
                />
              </label>
            )}
            <div className={`comparison-scale ${mode}`}>
              <div />
              <span>
                {mode === "change" ? "−0.30 · less green" : "−0.2 · lower NDVI"}
              </span>
              <span>{mode === "change" ? "0 · unchanged" : "0.4"}</span>
              <span>
                {mode === "change" ? "+0.30 · more green" : "1.0 · higher NDVI"}
              </span>
            </div>
            <p>
              Transparent pixels: insufficient paired data or excluded water/QA.
              Colors saturate at the legend endpoints; downloaded values retain
              the full range.
            </p>
            <div className="comparison-summary">
              <span>
                <b>{data.summary?.pairedCoveragePercent}%</b> paired pixels /
                full native raster footprint (includes water and excluded cells)
              </span>
              <span>
                <b>{data.summary?.meanChange.toFixed(4)}</b> mean ΔNDVI on
                paired native pixels
              </span>
            </div>
            <p aria-live="polite">
              {sample
                ? `Selected pixel: before ${sample[0]?.toFixed(4) ?? "no reliable data"}; after ${sample[1]?.toFixed(4) ?? "no reliable data"}; change ${sample[2]?.toFixed(4) ?? "unavailable"}. Complete seasonal years: ${sample[3] ?? 0}/5 before; ${sample[4] ?? 0}/5 after.`
                : "Select a pixel on the map to inspect its measured values."}
            </p>
            <p>{data.method}</p>
            <div className="source-links">
              {["before", "after", "change", "beforeYears", "afterYears"].map(
                (k) => (
                  <a key={k} href={`/data/sundarbans/${k}.tif`} download>
                    Download {k} GeoTIFF
                  </a>
                ),
              )}
            </div>
          </>
        )}
        <p>
          Greenness change is descriptive. It does not establish tree loss,
          forest gain or causation. Tides, mixed pixels and changing shoreline
          coverage remain limitations.
        </p>
        {data && (
          <a
            className="comparison-reference"
            href={data.study.locationReference}
            target="_blank"
            rel="noreferrer"
          >
            Study-location reference · UNESCO
          </a>
        )}
      </div>
    </section>
  );
}
