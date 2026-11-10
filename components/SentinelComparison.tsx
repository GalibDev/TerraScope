"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  Trees,
  Columns2,
  Leaf,
  MousePointer2,
  Scan,
  ShieldCheck,
  Download,
} from "lucide-react";
type Dataset = {
  width: number;
  height: number;
  bounds: number[];
  coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  bbox: [number, number, number, number];
  before: string;
  after: string;
  pairedCoveragePercent: number;
  meanChange: number;
  method: string;
  scenes: Record<string, { id: string; date: string; cloud: number }[]>;
};
export default function SentinelComparison() {
  const [requested, setRequested] = useState(false);
  const sectionEl = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const [selecting, setSelecting] = useState(false);
  const moveDivider = (x: number) => {
    const rect = baseEl.current?.getBoundingClientRect();
    if (rect)
      setSplit(
        Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)),
      );
  };
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (sectionEl.current) observer.observe(sectionEl.current);
    return () => observer.disconnect();
  }, []);
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState("");
  const [view, setView] = useState<"rgb" | "ndvi" | "change">("rgb"),
    [split, setSplit] = useState(50),
    [sample, setSample] = useState<number[] | null>(null);
  const baseEl = useRef<HTMLDivElement>(null),
    topEl = useRef<HTMLDivElement>(null),
    maps = useRef<maplibregl.Map[]>([]),
    grids = useRef<Record<string, Float32Array>>({});
  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    fetch("/data/sentinel2/manifest.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(async (d) => {
        if (
          !Number.isInteger(d.width) ||
          !Number.isInteger(d.height) ||
          d.width * d.height > 4000000 ||
          d.coordinates?.length !== 4
        )
          throw Error();
        const entries = await Promise.all(
          ["before", "after", "change", "beforeCount", "afterCount"].map(
            async (key) => {
              const r = await fetch(`/data/sentinel2/${key}.bin`);
              if (!r.ok) throw Error();
              const b = await r.arrayBuffer();
              if (b.byteLength !== d.width * d.height * 4) throw Error();
              return [key, new Float32Array(b)] as const;
            },
          ),
        );
        if (!cancelled) {
          grids.current = Object.fromEntries(entries);
          setData(d);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Detailed dataset could not load. Please reload.");
      });
    return () => {
      cancelled = true;
    };
  }, [requested]);
  useEffect(() => {
    if (!data || !baseEl.current || !topEl.current) return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    const style = (after: boolean): maplibregl.StyleSpecification => ({
      version: 8,
      sources: {
        ...Object.fromEntries(
          [
            "before-rgb",
            "after-rgb",
            "before-ndvi",
            "after-ndvi",
            "change-ndvi",
          ].map((id) => [
            id,
            {
              type: "image",
              url: `/data/sentinel2/${id}.png`,
              coordinates: data.coordinates,
            },
          ]),
        ),
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#102d35" },
        },
        ...[
          "before-rgb",
          "after-rgb",
          "before-ndvi",
          "after-ndvi",
          "change-ndvi",
        ].map((id) => ({
          id,
          type: "raster" as const,
          source: id,
          layout: {
            visibility: (id === (after ? "after-rgb" : "before-rgb")
              ? "visible"
              : "none") as "visible" | "none",
          },
          paint: {
            "raster-resampling": "nearest" as const,
            "raster-fade-duration": 0,
          },
        })),
      ],
    });
    try {
      const base = new maplibregl.Map({
        container: baseEl.current,
        style: style(false),
        bounds: [
          [data.bbox[0], data.bbox[1]],
          [data.bbox[2], data.bbox[3]],
        ],
        fitBoundsOptions: { padding: 10 },
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
      });
      const top = new maplibregl.Map({
        container: topEl.current,
        style: style(true),
        center: base.getCenter(),
        zoom: base.getZoom(),
        interactive: false,
        attributionControl: false,
      });
      maps.current = [base, top];
      base.touchZoomRotate.disableRotation();
      base.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      base.addControl(
        new maplibregl.FullscreenControl({
          container: baseEl.current.parentElement!,
        }),
        "top-right",
      );
      base.addControl(
        new maplibregl.ScaleControl({ unit: "metric" }),
        "bottom-left",
      );
      const sync = () =>
        top.jumpTo({ center: base.getCenter(), zoom: base.getZoom() });
      base.on("move", sync);
      const resize = new ResizeObserver(() => {
        base.resize();
        top.resize();
        sync();
      });
      resize.observe(baseEl.current);
      const selectionEl = document.createElement("div");
      selectionEl.className = "sentinel-selection";
      const selectionMarker = new maplibregl.Marker({ element: selectionEl });
      base.on("click", (ev) => {
        selectionMarker.setLngLat(ev.lngLat).addTo(base);
        const x = (6378137 * ev.lngLat.lng * Math.PI) / 180,
          y =
            6378137 *
            Math.log(Math.tan(Math.PI / 4 + (ev.lngLat.lat * Math.PI) / 360));
        const [l, b, r, t] = data.bounds;
        const col = Math.floor(((x - l) / (r - l)) * data.width),
          row = Math.floor(((t - y) / (t - b)) * data.height);
        setSample(
          ["before", "after", "change", "beforeCount", "afterCount"].map((k) =>
            row >= 0 && col >= 0 && row < data.height && col < data.width
              ? grids.current[k][row * data.width + col]
              : NaN,
          ),
        );
      });
      for (const m of maps.current)
        m.on("error", () =>
          setError(
            "Map could not render. Scientific downloads remain available.",
          ),
        );
      return () => {
        resize.disconnect();
        selectionMarker.remove();
        base.remove();
        top.remove();
        maps.current = [];
      };
    } catch {
      queueMicrotask(() =>
        setError("WebGL map is unavailable on this device."),
      );
    }
  }, [data]);
  useEffect(() => {
    const ids = [
      "before-rgb",
      "after-rgb",
      "before-ndvi",
      "after-ndvi",
      "change-ndvi",
    ];
    const updates = maps.current.map((m, i) => {
      const apply = () =>
        ids.forEach((id) => {
          if (m.getLayer(id))
            m.setLayoutProperty(
              id,
              "visibility",
              id ===
                (view === "change"
                  ? "change-ndvi"
                  : `${i ? "after" : "before"}-${view}`)
                ? "visible"
                : "none",
            );
        });
      if (m.isStyleLoaded()) apply();
      else m.once("load", apply);
      return () => m.off("load", apply);
    });
    return () => updates.forEach((f) => f());
  }, [data, view]);
  useEffect(() => {
    const base = maps.current[0];
    if (!base) return;
    if (selecting) base.dragPan.disable();
    else base.dragPan.enable();
    base.getCanvas().style.cursor = selecting ? "crosshair" : "";
  }, [data, selecting]);
  return (
    <section
      className="card sentinel-card sentinel-primary"
      id="sundarbans"
      ref={sectionEl}
    >
      <span id="sentinel2" />
      <div className="card-heading sentinel-banner">
        <div className="sentinel-brand-icon">
          <Trees size={34} />
        </div>
        <div>
          <div className="eyebrow">DETAILED VIEW · COPERNICUS / ESA</div>
          <h2>
            Sundarbans <span>comparison</span>
          </h2>
          <p>10 m imagery and NDVI · January 2020 versus January 2024</p>
        </div>
        <span className="sentinel-pill">
          Exploratory comparison · Sentinel-2
        </span>
        <a
          className="sentinel-export"
          href="/data/sentinel2/change.tif"
          download
        >
          <Download size={16} /> Export GeoTIFF
        </a>
      </div>
      <div className="sentinel-content">
        <p>
          একই ছোট pilot এলাকা। এটি পুরো সুন্দরবন বা official forest boundary নয়।
          True-color ছবি জায়গা চিনতে সাহায্য করে; NDVI পরিবর্তন দেখতে NDVI view
          বেছে নিন।
        </p>
        {error && <p role="alert">{error}</p>}
        {!requested ? (
          <button className="sentinel-load" onClick={() => setRequested(true)}>
            Load detailed Sentinel-2 comparison · 10 m
          </button>
        ) : !data ? (
          <p role="status">
            {error
              ? "Dataset unavailable"
              : "Loading verified Sentinel-2 images and pixel measurements…"}
          </p>
        ) : (
          <>
            <div className="sentinel-controls">
              {(["rgb", "ndvi", "change"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "rgb" ? (
                    <>
                      <Columns2 size={18} />
                      Before / after
                    </>
                  ) : v === "ndvi" ? (
                    <>
                      <Leaf size={18} />
                      Measured NDVI
                    </>
                  ) : (
                    "NDVI change"
                  )}
                </button>
              ))}
              <button
                aria-pressed={selecting}
                onClick={() => setSelecting(!selecting)}
              >
                <MousePointer2 size={18} />
                {selecting ? "Done selecting" : "Select pixel"}
              </button>
              <span className="sentinel-toolbar-note">
                True-color imagery + measured NDVI · 10 m
              </span>
            </div>
            <div className="sentinel-layout">
              <div>
                <div className="sentinel-map">
                  <div
                    ref={baseEl}
                    className="sentinel-canvas"
                    aria-label="Sentinel-2 comparison map"
                  />
                  <div
                    ref={topEl}
                    className="sentinel-canvas sentinel-overlay"
                    aria-hidden="true"
                    style={{
                      clipPath: `inset(0 0 0 ${split}%)`,
                      visibility: view === "change" ? "hidden" : "visible",
                    }}
                  />
                  {view !== "change" && (
                    <>
                      <span className="sentinel-period before">
                        BEFORE · {data.before}
                      </span>
                      <span className="sentinel-period after">
                        AFTER · {data.after}
                      </span>
                      <div
                        className="sentinel-line"
                        style={{ left: `${split}%` }}
                      />
                      <button
                        className="sentinel-handle"
                        role="slider"
                        aria-label="Sundarbans comparison divider"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(split)}
                        style={{
                          left: `clamp(24px, ${split}%, calc(100% - 24px))`,
                        }}
                        onPointerDown={(ev) => {
                          ev.preventDefault();
                          dragging.current = true;
                          ev.currentTarget.setPointerCapture(ev.pointerId);
                          moveDivider(ev.clientX);
                        }}
                        onPointerMove={(ev) => {
                          if (dragging.current) moveDivider(ev.clientX);
                        }}
                        onPointerUp={(ev) => {
                          dragging.current = false;
                          ev.currentTarget.releasePointerCapture(ev.pointerId);
                        }}
                        onPointerCancel={() => {
                          dragging.current = false;
                        }}
                        onKeyDown={(ev) => {
                          if (
                            ![
                              "ArrowLeft",
                              "ArrowRight",
                              "Home",
                              "End",
                            ].includes(ev.key)
                          )
                            return;
                          ev.preventDefault();
                          setSplit((v) =>
                            ev.key === "Home"
                              ? 0
                              : ev.key === "End"
                                ? 100
                                : Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      v +
                                        (ev.key === "ArrowRight" ? 1 : -1) *
                                          (ev.shiftKey ? 10 : 1),
                                    ),
                                  ),
                          );
                        }}
                      >
                        ‹ ›
                      </button>
                    </>
                  )}
                  <span className="sentinel-source">
                    Contains modified Copernicus Sentinel data (2020, 2024) ·
                    ESA · Earth Search
                  </span>
                </div>
                {view !== "change" && (
                  <label className="comparison-slider">
                    Before / after divider
                    <input
                      aria-label="Sentinel-2 before and after divider"
                      type="range"
                      min={0}
                      max={100}
                      value={split}
                      onChange={(ev) => setSplit(+ev.target.value)}
                    />
                  </label>
                )}
                <p>
                  {view === "rgb"
                    ? "True-color: same display stretch on both sides. These are January composites, not single-day images."
                    : view === "ndvi"
                      ? "NDVI scale: −0.2 lower greenness → 0.4 → 1.0 higher greenness."
                      : "Change scale: −0.30 decrease → 0 → +0.30 increase. Colours saturate; pixel values retain full range."}
                </p>
                <div
                  className={`comparison-scale ${view === "change" ? "change" : "compare"}`}
                  style={{ display: view === "rgb" ? "none" : undefined }}
                >
                  <div />
                  <span>{view === "change" ? "−0.30" : "−0.2"}</span>
                  <span>{view === "change" ? "0" : "0.4"}</span>
                  <span>{view === "change" ? "+0.30" : "1.0"}</span>
                </div>
              </div>
              <aside className="sentinel-inspection">
                <h3>
                  <Scan size={19} /> Pixel inspection
                </h3>
                <p>Map-এ click করলে একই জায়গার measured NDVI দেখা যাবে।</p>
                <div role="status">
                  {sample && sample.slice(0, 3).every(Number.isFinite) ? (
                    <>
                      <dl>
                        {["Before NDVI", "After NDVI", "Change"].map(
                          (label, i) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>
                                {sample[i] > 0 && i === 2 ? "+" : ""}
                                {sample[i].toFixed(4)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                      <p>
                        Clear observations: {sample[3]}/3 before · {sample[4]}/3
                        after
                      </p>
                    </>
                  ) : (
                    <p>
                      {sample
                        ? "এই জায়গায় দুই সময়ের যথেষ্ট clear land observations নেই।"
                        : "Select a location to inspect its values."}
                    </p>
                  )}
                </div>
                <h3>
                  <ShieldCheck size={19} /> Data quality & coverage
                </h3>
                <p>
                  <b>{data.pairedCoveragePercent}%</b> paired land pixels / full
                  pilot raster footprint, including water.
                </p>
                <p>
                  Mean ΔNDVI:{" "}
                  <b>
                    {data.meanChange > 0 ? "+" : ""}
                    {data.meanChange.toFixed(4)}
                  </b>
                </p>
                <p>
                  Quality masks use 20 m scene classification. 10 m image pixels
                  do not mean 10 m cloud-mask accuracy.
                </p>
                <p className="sentinel-warning">
                  Exploratory seasonal comparison. Not tree counts, forest-loss
                  estimates or a significance test. Coverage is not comparable
                  directly with the MODIS study’s different years and method.
                </p>
              </aside>
            </div>
            <details>
              <summary>Sources and processing method</summary>
              <p>{data.method}</p>
              {Object.entries(data.scenes).map(([period, scenes]) => (
                <div key={period}>
                  <b>{period}</b>
                  <ul>
                    {scenes.map((scene) => (
                      <li key={scene.id}>
                        {scene.id} · scene cloud {scene.cloud}%
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <a
                href="https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a"
                target="_blank"
                rel="noreferrer"
              >
                Earth Search Sentinel-2 L2A collection ↗
              </a>
            </details>
            <div className="sentinel-downloads">
              {["before", "after", "change"].map((k) => (
                <a href={`/data/sentinel2/${k}.tif`} download key={k}>
                  Download {k} NDVI GeoTIFF ↓
                </a>
              ))}
              <a href="/data/sentinel2/manifest.json" download>
                Source manifest ↓
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
