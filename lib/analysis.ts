import { z } from "zod";
export const rawSchema = z.object({
  date: z.iso.date(),
  value: z.number().finite(),
  qa: z.number().int().min(0).max(65535),
});
export type Observation = { date: string; value: number };
export type Classification =
  "Greening" | "Browning" | "No clear directional trend" | "Insufficient data";
export type TrendResult = {
  slope: number | null;
  classification: Classification;
  n: number;
  interval: [number, number] | null;
  standardError: number | null;
  lag: number | null;
  reason: string;
  annual: { year: number; value: number }[];
};
export function prepare(input: unknown[], scaled = false): Observation[] {
  const seen = new Set<string>();
  const out: Observation[] = [];
  for (const item of input) {
    const parsed = rawSchema.safeParse(item);
    if (!parsed.success) continue;
    const r = parsed.data;
    // Strict DetailedQA: good MODLAND, highest usefulness, low/average aerosol, no adjacent/mixed cloud, snow or shadow.
    if (
      (r.qa & 3) !== 0 ||
      ((r.qa >> 2) & 15) > 2 ||
      ((r.qa >> 6) & 3) > 1 ||
      r.qa & ((1 << 8) | (1 << 10) | (1 << 14) | (1 << 15))
    )
      continue;
    if (r.value === -3000) continue;
    const value = scaled ? r.value : r.value * 0.0001;
    if (value < -0.2 || value > 1 || seen.has(r.date)) continue;
    seen.add(r.date);
    out.push({ date: r.date, value });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function monthly(rows: Observation[]) {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) || []), r.value]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      value: v.reduce((a, b) => a + b, 0) / v.length,
      count: v.length,
    }));
}
export function trend(rows: Observation[]): TrendResult {
  // Equal-weight monthly means prevent a month with more composites receiving more annual weight.
  rows = monthly(rows);
  const annual = new Map<string, Observation[]>();
  for (const r of rows)
    annual.set(r.date.slice(0, 4), [
      ...(annual.get(r.date.slice(0, 4)) || []),
      r,
    ]);
  const complete = [...annual]
    .filter(([, r]) => new Set(r.map((x) => x.date.slice(5, 7))).size === 12)
    .map(([year, r]) => ({
      x: +year,
      y: r.reduce((s, x) => s + x.value, 0) / r.length,
    }))
    .sort((a, b) => a.x - b.x);
  const n = complete.length;
  const annualValues = complete.map((r) => ({ year: r.x, value: r.y }));
  if (n < 5)
    return {
      slope: null,
      classification: "Insufficient data",
      n,
      interval: null,
      standardError: null,
      lag: null,
      reason:
        "At least five complete 12-month years are required for a descriptive slope.",
      annual: annualValues,
    };
  const mx = complete.reduce((s, r) => s + r.x, 0) / n,
    my = complete.reduce((s, r) => s + r.y, 0) / n;
  const xx = complete.reduce((s, r) => s + (r.x - mx) ** 2, 0),
    slope = complete.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0) / xx;
  const descriptive: TrendResult = {
    slope,
    classification: "Insufficient data",
    n,
    interval: null,
    standardError: null,
    lag: null,
    reason:
      "Inference requires at least 20 consecutive complete years; slope is descriptive only.",
    annual: annualValues,
  };
  if (n < 20 || complete.some((r, i) => i > 0 && r.x !== complete[i - 1].x + 1))
    return descriptive;
  const residual = complete.map((r) => r.y - my - slope * (r.x - mx));
  if (residual.reduce((s, e) => s + e * e, 0) < 1e-16)
    return {
      ...descriptive,
      reason:
        "Degenerate residual variance; uncertainty cannot be reliably estimated.",
    };
  // Newey–West sandwich for slope with centered regressor, Bartlett kernel and n/(n−2) correction.
  // Annual rows must be consecutive: gaps are never compressed into adjacent observations.
  const lag = Math.floor(4 * (n / 100) ** (2 / 9));
  const score = complete.map((r, i) => (r.x - mx) * residual[i]);
  let meat = score.reduce((s, v) => s + v * v, 0);
  for (let l = 1; l <= lag; l++) {
    let cross = 0;
    for (let t = l; t < n; t++) cross += score[t] * score[t - l];
    meat += 2 * (1 - l / (lag + 1)) * cross;
  }
  const variance = ((meat / (xx * xx)) * n) / (n - 2);
  if (!Number.isFinite(variance) || variance <= 0)
    return { ...descriptive, reason: "HAC covariance could not be estimated." };
  const standardError = Math.sqrt(variance),
    interval: [number, number] = [
      slope - 1.959963984540054 * standardError,
      slope + 1.959963984540054 * standardError,
    ];
  return {
    slope,
    n,
    interval,
    standardError,
    lag,
    annual: annualValues,
    classification:
      interval[0] > 0
        ? "Greening"
        : interval[1] < 0
          ? "Browning"
          : "No clear directional trend",
    reason:
      "Approximate 95% Newey–West interval; exploratory, unadjusted for multiple comparisons. Assumes a stable linear trend and short-memory residuals.",
  };
}
export function coverage(input: unknown[], scaled = false) {
  const valid = prepare(input, scaled);
  const months = new Set(valid.map((r) => r.date.slice(0, 7)));
  return {
    submitted: input.length,
    accepted: valid.length,
    excluded: input.length - valid.length,
    observedMonths: months.size,
    first: valid[0]?.date ?? null,
    last: valid.at(-1)?.date ?? null,
  };
}
export function seasonal(rows: Observation[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const v = rows.filter((r) => +r.date.slice(5, 7) === i + 1);
    return {
      month: new Date(2000, i).toLocaleString("en", { month: "short" }),
      value: v.length ? v.reduce((s, r) => s + r.value, 0) / v.length : null,
    };
  });
}
export function anomalies(rows: Observation[], start = 2001, end = 2010) {
  return rows.map((r) => {
    const b = rows.filter(
      (x) =>
        +x.date.slice(0, 4) >= start &&
        +x.date.slice(0, 4) <= end &&
        x.date.slice(5, 7) === r.date.slice(5, 7),
    );
    const mean = b.reduce((s, x) => s + x.value, 0) / b.length;
    const sd = Math.sqrt(
      b.reduce((s, x) => s + (x.value - mean) ** 2, 0) / (b.length - 1),
    );
    return { ...r, z: b.length >= 5 && sd > 0 ? (r.value - mean) / sd : null };
  });
}
export function demo(region = 0, index = "NDVI"): Observation[] {
  return Array.from({ length: 24 * 12 }, (_, i) => ({
    date: `${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
    value:
      Math.max(
        -0.2,
        Math.min(
          1,
          (region === 3 ? 0.16 : 0.52 - region * 0.035) +
            0.13 * Math.sin((((i % 12) - 3) * Math.PI) / 6) +
            i * (region === 3 ? -0.00005 : 0.00016) +
            0.018 * Math.sin(i * 1.7),
        ),
      ) * (index === "EVI" ? 0.78 : 1),
  }));
}
