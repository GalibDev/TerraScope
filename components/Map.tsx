"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { regions } from "@/lib/regions";
import type { FeatureCollection, Point } from "geojson";
export default function Map({
  region,
  date,
  onSelect,
  points,
  index,
}: {
  region: string;
  date: string;
  onSelect: (id: string) => void;
  points: FeatureCollection<Point>;
  index: string;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState("");
  const [satellite, setSatellite] = useState(true);
  const [analytical, setAnalytical] = useState(true);
  const imageryVisibility = useRef(true);
  useEffect(() => {
    if (!el.current) return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: el.current,
        center: [91, 24],
        zoom: 4.6,
        style: {
          version: 8,
          sources: {
            imagery: {
              type: "raster",
              tiles: [
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
              ],
              tileSize: 256,
              maxzoom: 9,
              attribution: "NASA GIBS · MODIS Terra",
            },
            boundary: {
              type: "geojson",
              data: "/data/bangladesh-boundary.geojson",
              attribution:
                "geoBoundaries gbOpen · CC0 · Bangladesh ADM0 (2015)",
            },
            analytical: {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#102b36" },
            },
            {
              id: "imagery",
              type: "raster",
              source: "imagery",
              layout: {
                visibility: imageryVisibility.current ? "visible" : "none",
              },
              paint: { "raster-opacity": 0.78, "raster-saturation": -0.3 },
            },
            {
              id: "bangladesh-fill",
              type: "fill",
              source: "boundary",
              paint: { "fill-color": "#4ce0ac", "fill-opacity": 0.06 },
            },
            {
              id: "bangladesh-outline",
              type: "line",
              source: "boundary",
              paint: {
                "line-color": "#4ce0ac",
                "line-width": 1.5,
                "line-opacity": 0.85,
              },
            },
            {
              id: "analytical-points",
              type: "circle",
              source: "analytical",
              paint: {
                "circle-radius": 21,
                "circle-opacity": 0.8,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "value"],
                  -0.2,
                  "#83583d",
                  0,
                  "#c9b977",
                  0.4,
                  "#83c993",
                  1,
                  "#08764a",
                ],
              },
            },
          ],
        },
      });
    } catch {
      queueMicrotask(() =>
        setError(
          "Interactive map requires WebGL. Your charts and analysis remain available.",
        ),
      );
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.on("error", () =>
      setError(
        "Imagery could not load. Check connection or choose another date.",
      ),
    );
    m.on("load", () => setError(""));
    for (const r of regions) {
      const b = document.createElement("button");
      b.className = "map-marker";
      b.title = `Select ${r.name}`;
      b.setAttribute("aria-label", b.title);
      b.style.background = r.color;
      b.onclick = () => onSelect(r.id);
      new maplibregl.Marker({ element: b }).setLngLat(r.center).addTo(m);
    }
    return () => {
      m.remove();
      map.current = null;
    };
  }, [date, onSelect]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const update = () => {
      (
        m.getSource("analytical") as maplibregl.GeoJSONSource | undefined
      )?.setData(points);
      if (m.getLayer("analytical-points"))
        m.setLayoutProperty(
          "analytical-points",
          "visibility",
          analytical ? "visible" : "none",
        );
    };
    if (m.isStyleLoaded()) update();
    else m.once("load", update);
    return () => {
      m.off("load", update);
    };
  }, [points, analytical, date]);
  useEffect(() => {
    const r = regions.find((r) => r.id === region);
    if (r)
      map.current?.flyTo({
        center: r.center,
        zoom: region === "bangladesh" ? 5.5 : 5,
        duration: 1200,
      });
  }, [region, date]);
  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <div className="map-top">
        <span className="map-tag">
          <i /> NASA MODIS · TRUE COLOR
        </span>
        <button
          className="map-tag"
          disabled={!points.features.length}
          onClick={() => setAnalytical(!analytical)}
        >
          {points.features.length
            ? `${analytical ? "Hide" : "Show"} ${index} points`
            : "No analytical observations"}
        </button>
        <button
          className="map-tag"
          onClick={() => {
            const m = map.current;
            if (m?.getLayer("imagery"))
              m.setLayoutProperty(
                "imagery",
                "visibility",
                satellite ? "none" : "visible",
              );
            setSatellite(!satellite);
            imageryVisibility.current = !satellite;
          }}
        >
          {satellite ? "Hide imagery" : "Show imagery"}
        </button>
      </div>
      <div className="map-bottom">
        <span>◎ Study points · gbOpen Bangladesh outline (2015)</span>
        <span>Imagery {date}</span>
      </div>
      {points.features.length > 0 && analytical && (
        <div className="analytical-legend">
          <b>Measured point mean {index}</b>
          <div />
          <span>
            −0.2 <span>0.4</span> 1.0 · unitless
          </span>
          <small>
            Selected analysis period · point samples, not spatial coverage
          </small>
        </div>
      )}
      {error && (
        <p className="map-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
