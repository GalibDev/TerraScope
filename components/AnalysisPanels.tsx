"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { FlaskConical, Download, ChartNoAxesCombined } from "lucide-react";
import { anomalies, monthly, trend } from "@/lib/analysis";
import type { Observation } from "@/lib/analysis";
import { regions } from "@/lib/regions";
export type MeasuredSeries = {
  region: string;
  index: string;
  observations: Observation[];
  coverage?: {
    submitted: number;
    accepted: number;
    excluded: number;
    observedMonths: number;
    first: string | null;
    last: string | null;
  };
  provenance?: { taskId: string; retrievedAt: string; processingNotes: string };
};
export default function AnalysisPanels({
  series,
  rows,
  fullRows,
  region,
  index,
  start,
  end,
  demo,
  comparisons,
}: {
  series: MeasuredSeries[];
  rows: Observation[];
  fullRows: Observation[];
  region: string;
  index: string;
  start: number;
  end: number;
  demo: boolean;
  comparisons: string[];
}) {
  const selected = regions.find((r) => r.id === region)!;
  const stats = trend(rows);
  const selectedSeries = series.find(
    (s) => s.region === region && s.index === index,
  );
  const months = monthly(rows);
  const anomaly = useMemo(
    () =>
      anomalies(monthly(fullRows)).filter(
        (r) => +r.date.slice(0, 4) >= start && +r.date.slice(0, 4) <= end,
      ),
    [fullRows, start, end],
  );
  const flagged = anomaly.filter((r) => r.z !== null && Math.abs(r.z) >= 2);
  const usable = anomaly.filter((r) => r.z !== null).length;
  const comparison = regions
    .filter((r) => r.id === region || comparisons.includes(r.id))
    .map((r) => {
      const values =
        r.id === region
          ? rows
          : series
              .find((s) => s.region === r.id && s.index === index)
              ?.observations.filter(
                (v) =>
                  +v.date.slice(0, 4) >= start && +v.date.slice(0, 4) <= end,
              ) || [];
      return { region: r, ...trend(values) };
    });
  function exportReport() {
    const report = {
      source: demo
        ? "ILLUSTRATIVE SYNTHETIC — NOT NASA MEASUREMENTS"
        : "MOD13Q1.061 operator-provided observations",
      region: selected.name,
      studyType: "representative point",
      index,
      period: { start, end },
      provenance: demo ? null : selectedSeries?.provenance,
      method:
        "OLS on equal-weight complete-year monthly means; exploratory approximate 95% Bartlett Newey–West interval only with >=20 consecutive years",
      trend: stats,
      coverage: {
        observedMonths: months.length,
        possibleMonths: (end - start + 1) * 12,
        sourceImport: demo ? null : selectedSeries?.coverage,
      },
      anomaly: {
        baseline: "2001–2010 calendar-month mean/sample SD; >=5 observations",
        flag: "|z| >= 2; descriptive, not disaster attribution",
        eligible: usable,
        flagged: flagged.map((r) => ({ date: r.date, z: r.z })),
      },
      limitations: [
        "Point samples are not country averages",
        "Approximate intervals assume stable linear trend and short-memory residuals",
        "No multiple-comparison adjustment",
        "NDVI alone does not establish cause",
      ],
    };
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = `terrascope-${region}-${demo ? "demo" : "measured"}-report.json`;
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <>
      <section className="card inference-card">
        <div className="card-heading">
          <div>
            <h2>
              <FlaskConical size={18} /> Trend evidence, with uncertainty
            </h2>
            <p>
              {selected.name} · {start}–{end} · {index} units/year{" "}
              {demo ? "· SYNTHETIC DEMO" : ""}
            </p>
          </div>
          <button
            className="secondary"
            disabled={!rows.length}
            onClick={exportReport}
          >
            <Download size={14} /> Export report
          </button>
        </div>
        <div className="inference-content">
          <div className="inference-values">
            <div>
              <small>CLASSIFICATION {demo ? "(DEMO)" : ""}</small>
              <b
                className={
                  stats.classification === "Browning" ? "amber" : "mint"
                }
              >
                {stats.classification}
              </b>
            </div>
            <div>
              <small>APPROXIMATE 95% HAC INTERVAL</small>
              <b>
                {stats.interval
                  ? `${stats.interval[0].toFixed(5)} to ${stats.interval[1].toFixed(5)}`
                  : "Insufficient evidence"}
              </b>
            </div>
            <div>
              <small>COMPLETE YEARS / HAC LAGS</small>
              <b>
                {stats.n} / {stats.lag ?? "—"}
              </b>
            </div>
          </div>
          <p>{stats.reason}</p>
          {demo && (
            <p className="amber">
              These calculations describe synthetic input only. They provide no
              evidence of change on Earth.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Selected study point</th>
                  <th>Slope / year</th>
                  <th>95% interval</th>
                  <th>Evidence category</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.region.id}>
                    <td>{c.region.name}</td>
                    <td>{c.slope?.toFixed(5) ?? "—"}</td>
                    <td>
                      {c.interval
                        ? `${c.interval[0].toFixed(5)} … ${c.interval[1].toFixed(5)}`
                        : "Unavailable"}
                    </td>
                    <td>{c.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            Categories count selected study points, not land area:{" "}
            {comparison.filter((r) => r.classification === "Greening").length}{" "}
            greening ·{" "}
            {comparison.filter((r) => r.classification === "Browning").length}{" "}
            browning ·{" "}
            {
              comparison.filter(
                (r) => r.classification === "No clear directional trend",
              ).length
            }{" "}
            unclear ·{" "}
            {
              comparison.filter((r) => r.classification === "Insufficient data")
                .length
            }{" "}
            insufficient. {demo ? "Demo calculations only." : ""}
          </small>
        </div>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>
              <ChartNoAxesCombined size={18} /> Anomaly detective
            </h2>
            <p>
              Fixed baseline: 2001–2010 · calendar-month z-score{" "}
              {demo ? "· synthetic" : ""}
            </p>
          </div>
          <span className="pill">|z| ≥ 2</span>
        </div>
        {usable ? (
          <>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={anomaly}>
                  <CartesianGrid vertical={false} stroke="#E3E4DB" />
                  <XAxis
                    dataKey="date"
                    stroke="#5C6C63"
                    fontSize={10}
                    minTickGap={65}
                  />
                  <YAxis stroke="#5C6C63" fontSize={10} width={35} />
                  <Tooltip
                    contentStyle={{
                      background: "#FDFCF8",
                      border: "1px solid #DCDDD4",
                      color: "#202C29",
                    }}
                  />
                  <ReferenceLine y={2} stroke="#A87532" strokeDasharray="4 4" />
                  <ReferenceLine
                    y={-2}
                    stroke="#A87532"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine y={0} stroke="#77949a" />
                  <Bar
                    dataKey="z"
                    name={`Calendar-month z-score${demo ? " (demo)" : ""}`}
                    fill="#4B768D"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="analysis-note">
              {flagged.length} unusual observations / {usable} eligible months.
              No silent gap filling. Baseline includes selected-period
              observations when they overlap 2001–2010.
            </p>
          </>
        ) : (
          <div className="empty compact">
            <ChartNoAxesCombined size={28} />
            <b>Baseline evidence is unavailable.</b>
            <p>
              At least five valid baseline values per calendar month and nonzero
              variance are required.
            </p>
          </div>
        )}
        <div className="chart-note">
          A z-score is descriptive. Trends, crop cycles and changing coverage
          can influence anomalies; no disaster attribution.
        </div>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Coverage & observation quality</h2>
            <p>
              {selected.name} ·{" "}
              {demo ? "synthetic records" : "quality-filtered source records"}
            </p>
          </div>
        </div>
        <div className="coverage-content">
          <div className="coverage-number">
            {((months.length / ((end - start + 1) * 12)) * 100).toFixed(1)}%{" "}
            <small>months represented in selected period</small>
          </div>
          <progress
            aria-label="Monthly temporal coverage"
            max={(end - start + 1) * 12}
            value={months.length}
          />
          <dl>
            <div>
              <dt>Observed / possible months</dt>
              <dd>
                {months.length} / {(end - start + 1) * 12}
              </dd>
            </div>
            <div>
              <dt>Valid records in period</dt>
              <dd>{rows.length}</dd>
            </div>
            <div>
              <dt>Imported / retained / excluded (full source)</dt>
              <dd>
                {demo
                  ? "Synthetic; no satellite QA"
                  : selectedSeries?.coverage
                    ? `${selectedSeries.coverage.submitted} / ${selectedSeries.coverage.accepted} / ${selectedSeries.coverage.excluded}`
                    : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Last source retrieval</dt>
              <dd>
                {demo
                  ? "Demo only"
                  : selectedSeries?.provenance?.retrievedAt?.slice(0, 10) ||
                    "Not connected"}
              </dd>
            </div>
          </dl>
          <p>
            Excluded records combine invalid/range/fill, strict QA and duplicate
            dates. Temporal coverage is not spatial coverage or accuracy.
          </p>
        </div>
      </section>
    </>
  );
}
