import type { FeatureCollection, Point } from "geojson";
import { regions } from "./regions";
import { monthly } from "./analysis";
import type { Observation } from "./analysis";
export function pointFeatures(
  series: { region: string; index: string; observations: Observation[] }[],
  index: string,
  start: number,
  end: number,
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: series
      .filter((s) => s.index === index)
      .flatMap((s) => {
        const r = regions.find((r) => r.id === s.region);
        const rows = monthly(
          s.observations.filter(
            (v) => +v.date.slice(0, 4) >= start && +v.date.slice(0, 4) <= end,
          ),
        );
        if (!r || !rows.length) return [];
        return [
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: r.center },
            properties: {
              region: s.region,
              name: r.name,
              value: rows.reduce((a, b) => a + b.value, 0) / rows.length,
              index,
              source: "MOD13Q1.061",
              start,
              end,
              months: rows.length,
            },
          },
        ];
      }),
  };
}
