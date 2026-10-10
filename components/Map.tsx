"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { regions } from "@/lib/regions";
export default function Map({
  region,
  date,
  onSelect,
}: {
  region: string;
  date: string;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState("");
  const [satellite, setSatellite] = useState(true);
  useEffect(() => {
    if (!el.current) return;
    maplibregl.setWorkerUrl('/maplibre-worker.mjs');
    const m = new maplibregl.Map({
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
            paint: { "raster-opacity": 0.78, "raster-saturation": -0.3 },
          },
        ],
      },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.on("error", () =>
      setError(
        "Imagery could not load. Check connection or choose another date.",
      ),
    );
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
    const r = regions.find((r) => r.id === region);
    if (r)
      map.current?.flyTo({
        center: r.center,
        zoom: region === "bangladesh" ? 5.5 : 5,
        duration: 1200,
      });
  }, [region]);
  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <div className="map-top">
        <span className="map-tag">
          <i /> NASA MODIS · TRUE COLOR
        </span>
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
          }}
        >
          {satellite ? "Hide imagery" : "Show imagery"}
        </button>
      </div>
      <div className="map-bottom">
        <span>◎ Study points · not administrative boundaries</span>
        <span>Imagery {date}</span>
      </div>
      {error && (
        <p className="map-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
