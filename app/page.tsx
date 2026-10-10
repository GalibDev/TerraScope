"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  BarChart,
  Bar,
} from "recharts";
import {
  Globe2,
  LayoutDashboard,
  Map as MapIcon,
  ChartNoAxesCombined,
  Layers,
  FlaskConical,
  BookOpen,
  Database,
  ArrowUpRight,
  ArrowRight,
  Download,
  Leaf,
  Sparkles,
  ChevronDown,
  Check,
  Menu,
} from "lucide-react";
import { regions } from "@/lib/regions";
import { demo, monthly, seasonal, trend } from "@/lib/analysis";
import AnalysisPanels from "@/components/AnalysisPanels";
import type { MeasuredSeries } from "@/components/AnalysisPanels";
import { pointFeatures } from "@/lib/map-data";
import ClimateChart from "@/components/ClimateChart";
const MapView = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map loading">Loading Earth imagery…</div>,
});
const links = [
  ["Overview", LayoutDashboard, "overview"],
  ["Interactive map", MapIcon, "map"],
  ["Trend detective", ChartNoAxesCombined, "trends"],
  ["Region comparison", Layers, "regions"],
  ["Explain results", FlaskConical, "scientist"],
  ["Methodology", BookOpen, "methodology"],
  ["Data sources", Database, "sources"],
] as const;
export default function Home() {
  const [region, setRegion] = useState("bangladesh"),
    [index, setIndex] = useState("NDVI"),
    [start, setStart] = useState(2001),
    [end, setEnd] = useState(2024),
    [illustrative, setIllustrative] = useState(false),
    [comparisons, setComparisons] = useState(["assam", "chiang-mai"]),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [answerSelection, setAnswerSelection] = useState(""),
    [busy, setBusy] = useState(false),
    [climate, setClimate] = useState<Record<string, unknown> | null>(null),
    [climateBusy, setClimateBusy] = useState(false),
    [nav, setNav] = useState(false),
    [imageDate, setImageDate] = useState("2024-02-15");
  const [measured, setMeasured] = useState<MeasuredSeries[]>([]),
    [datasetStatus, setDatasetStatus] = useState("Loading dataset status…");
  useEffect(() => {
    fetch("/api/vegetation")
      .then((r) => r.json())
      .then((v) => {
        setMeasured(v.series || []);
        setDatasetStatus(
          v.message ||
            "Validated MODIS series loaded from operator-configured dataset.",
        );
      })
      .catch(() =>
        setDatasetStatus(
          "Dataset service unavailable. Retry by reloading this page.",
        ),
      );
  }, []);
  const selected = regions.find((r) => r.id === region)!;
  const fullRows = useMemo(
    () =>
      illustrative
        ? demo(
            regions.findIndex((r) => r.id === region),
            index,
          )
        : measured.find((s) => s.region === region && s.index === index)
            ?.observations || [],
    [illustrative, region, index, measured],
  );
  const analyticalPoints = useMemo(
    () =>
      pointFeatures(
        illustrative
          ? []
          : measured.filter(
              (s) => s.region === region || comparisons.includes(s.region),
            ),
        index,
        start,
        end,
      ),
    [measured, region, comparisons, index, start, end, illustrative],
  );
  const rows = useMemo(
    () =>
      fullRows.filter(
        (r) => +r.date.slice(0, 4) >= start && +r.date.slice(0, 4) <= end,
      ),
    [fullRows, start, end],
  );
  const data = monthly(rows),
    stats = trend(data),
    season = seasonal(data);
  const selectRegion = useCallback((id: string) => {
    setRegion(id);
    setClimate(null);
    setAnswer("");
  }, []);
  async function ask(q = question) {
    if (!q.trim()) return;
    setBusy(true);
    const selection = JSON.stringify([region, index, start, end, illustrative]);
    setAnswerSelection(selection);
    try {
      const r = await fetch("/api/scientist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          region,
          index,
          start,
          end,
          demo: illustrative,
        }),
      });
      const v = await r.json();
      setAnswer(v.answer || v.error);
    } catch {
      setAnswer(
        "Connection unavailable. NDVI alone cannot establish cause; validated observations are required.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadClimate() {
    setClimateBusy(true);
    try {
      const r = await fetch(`/api/climate?region=${region}&year=${end}`);
      setClimate({
        ...(await r.json()),
        requestRegion: region,
        requestYear: end,
      });
    } catch {
      setClimate({
        error: "Connection unavailable. Please retry.",
        requestRegion: region,
        requestYear: end,
      });
    } finally {
      setClimateBusy(false);
    }
  }
  function download() {
    const csv =
      "source,region,date,index,value\n" +
      rows
        .map((r) =>
          [
            illustrative ? "ILLUSTRATIVE SYNTHETIC" : "MOD13Q1.061",
            selected.name,
            r.date,
            index,
            r.value,
          ]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = `terrascope-${illustrative ? "illustrative" : "measured"}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  }
  const chartStyle = {
    background: "#FDFCF8",
    border: "1px solid #DCDDD4",
    borderRadius: 8,
    color: "#202C29",
  };
  return (
    <>
      <header>
        <a className="brand" href="#overview">
          <span className="brand-icon">
            <Globe2 size={25} />
          </span>
          <span>
            Terra<span className="mint">Scope</span>
            <small>BANGLADESH TO THE WORLD</small>
          </span>
        </a>
        <nav>
          <a className="active" href="#overview">
            Dashboard
          </a>
          <a href="#map">Explore map</a>
          <a href="#trends">Trends</a>
          <a href="#methodology">
            About the science <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="header-right">
          <span className="live">
            <i /> EARTH OBSERVATION LAB
          </span>
          <button
            className="icon-btn mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setNav(!nav)}
          >
            <Menu />
          </button>
          <span className="avatar">TS</span>
        </div>
      </header>
      <aside className={nav ? "open" : ""}>
        <div className="workspace-label">WORKSPACE</div>
        {links.map(([label, Icon, id], i) => (
          <a
            key={id}
            className={i === 0 ? "selected" : ""}
            href={`#${id}`}
            onClick={() => setNav(false)}
          >
            <Icon size={18} />
            {label}
            {i === 4 && <span className="new">AI</span>}
          </a>
        ))}
        <div className="sidebar-note">
          <Globe2 size={26} />
          <strong>
            Bangladesh,
            <br />in context.
          </strong>
          <p>Compare four study locations through a consistent scientific method.</p>
          <a href="#sources">
            Powered by NASA data <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <span className="mint">●</span> NASA Space Apps project
          <small>Independent project · no NASA endorsement</small>
        </div>
      </aside>
      <main id="overview">
        <div className="breadcrumb">
          Workspace <span>/</span> <b>Vegetation overview</b>
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> EARTH OBSERVATION ATLAS
            </div>
            <h1>Vegetation change<span className="heading-period">{start}—{end}</span></h1>
            <p>
              {selected.name} · MODIS vegetation indices · Quality, coverage and uncertainty.
            </p>
          </div>
          <button
            className="secondary"
            disabled={!rows.length}
            onClick={download}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
        <section className="filters">
          <div>
            <span className="filter-label">STUDY REGION</span>
            <label className="select">
              <Globe2 size={16} />
              <select
                aria-label="Study region"
                value={region}
                onChange={(e) => selectRegion(e.target.value)}
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="filter-label">ANALYSIS PERIOD</span>
            <div className="period">
              <select
                aria-label="Start year"
                value={start}
                onChange={(e) => setStart(Math.min(+e.target.value, end))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i}>{2001 + i}</option>
                ))}
              </select>
              <ArrowRight size={14} />
              <select
                aria-label="End year"
                value={end}
                onChange={(e) => setEnd(Math.max(+e.target.value, start))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i}>{2001 + i}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className="filter-label">VEGETATION INDEX</span>
            <div className="segmented">
              {["NDVI", "EVI"].map((v) => (
                <button
                  key={v}
                  className={index === v ? "chosen" : ""}
                  onClick={() => setIndex(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="mode-switch">
            <span className="filter-label">DATA MODE</span>
            <button
              onClick={() => setIllustrative(!illustrative)}
              className={illustrative ? "demo-toggle on" : "demo-toggle"}
            >
              <span />
              {illustrative ? "Illustrative demo" : "Measured data"}
            </button>
          </div>
        </section>
        <div className="notice">
          <Database size={17} />
          <span>
            {illustrative ? (
              <>
                <b>Illustrative demo is active.</b> All vegetation values are
                synthetic, for exploring the interface only.
              </>
            ) : (
              <>
                <b>Your scientific workspace is ready.</b> {datasetStatus}
              </>
            )}
          </span>
          <a href="#sources">
            {illustrative ? "View data policy" : "Setup guide"}{" "}
            <ArrowRight size={14} />
          </a>
        </div>
        <div className="dashboard-grid">
          <section className="card map-card" id="map">
            <div className="card-heading">
              <div>
                <h2>
                  <Globe2 size={18} /> Study area & satellite context
                </h2>
                <p>Satellite context for your selected study point</p>
              </div>
              <label className="small-date">
                Imagery date
                <input
                  type="date"
                  value={imageDate}
                  max="2024-12-31"
                  min="2003-01-01"
                  onChange={(e) =>
                    e.target.value && setImageDate(e.target.value)
                  }
                />
              </label>
            </div>
            <MapView
              region={region}
              date={imageDate}
              onSelect={selectRegion}
              points={analyticalPoints}
              index={index}
            />
            <div className="map-legend">
              <span>
                <i className="dot" /> Selected study location
              </span>
              <span>
                {analyticalPoints.features.length
                  ? `Measured point means · ${index} · ${start}–${end}`
                  : `True-color imagery · no measured ${index} points in selection`}
              </span>
            </div>
          </section>
          <section className="card study-card">
            <div className="eyebrow">REGION SPOTLIGHT</div>
            <div className="study-symbol">
              <Leaf size={34} />
            </div>
            <h2>{selected.name}</h2>
            <p>{selected.label.toLowerCase()} · representative study point</p>
            <div className="coordinate">
              {selected.center[1].toFixed(4)}° N <span>/</span>{" "}
              {selected.center[0].toFixed(4)}° E
            </div>
            <dl>
              <div>
                <dt>Dataset</dt>
                <dd>MOD13Q1.061</dd>
              </div>
              <div>
                <dt>Spatial resolution</dt>
                <dd>250 meters</dd>
              </div>
              <div>
                <dt>Source cadence</dt>
                <dd>16-day composite</dd>
              </div>
              <div>
                <dt>Trend assessment</dt>
                <dd className="amber">
                  {illustrative
                    ? "Demo only"
                    : rows.length
                      ? "Descriptive only"
                      : "Awaiting data"}
                </dd>
              </div>
            </dl>
            <div className="study-callout">
              <FlaskConical size={17} />
              <span>
                A study point is not a regional average. Land use and seasonal
                differences affect comparisons.
              </span>
            </div>
          </section>
        <section className="metrics">
          <article>
            <div className="metric-label">
              MEAN {index}
              <Leaf size={17} />
            </div>
            <div className="metric-value">
              {rows.length
                ? (data.reduce((s, r) => s + r.value, 0) / data.length).toFixed(
                    3,
                  )
                : "—"}
              <small>{index} units</small>
            </div>
            <p>
              {illustrative
                ? "Synthetic study-point average"
                : rows.length
                  ? "Quality-filtered study-point average"
                  : "Awaiting validated observations"}
            </p>
            <div className="metric-footer">
              {selected.name}
              <span className="mint">
                {illustrative
                  ? "DEMO"
                  : rows.length
                    ? "MODIS"
                    : "NOT CONNECTED"}
              </span>
            </div>
          </article>
          <article>
            <div className="metric-label">
              LONG-TERM CHANGE
              <ChartNoAxesCombined size={17} />
            </div>
            <div className="metric-value">
              {stats.slope === null
                ? "—"
                : `${stats.slope >= 0 ? "+" : ""}${stats.slope.toFixed(4)}`}
              <small>units / year</small>
            </div>
            <p>
              {stats.slope === null
                ? "Insufficient evidence"
                : stats.interval
                  ? "OLS · approximate HAC uncertainty"
                  : "Descriptive OLS · insufficient inference evidence"}
            </p>
            <div className="metric-footer">
              Complete-year means<span>{stats.n} years</span>
            </div>
          </article>
          <article>
            <div className="metric-label">
              VALID OBSERVATIONS
              <Layers size={17} />
            </div>
            <div className="metric-value">
              {rows.length || "—"}
              <small>observations</small>
            </div>
            <p>
              {illustrative
                ? "Synthetic monthly values · no gaps"
                : rows.length
                  ? "Quality-filtered records · no interpolation"
                  : "Strict quality filtering required"}
            </p>
            <div className="metric-footer">
              {start}–{end}
              <span>250 m · 16-day source</span>
            </div>
          </article>
          <article>
            <div className="metric-label">
              TREND CONFIDENCE
              <FlaskConical size={17} />
            </div>
            <div className="metric-value text-value">
              {illustrative
                ? "Demo only"
                : stats.interval
                  ? "Exploratory"
                  : rows.length
                    ? "Insufficient"
                    : "Pending"}
            </div>
            <p>
              {illustrative
                ? "Synthetic data cannot establish change"
                : rows.length
                  ? stats.interval
                    ? "Approximate 95% Newey–West interval"
                    : "Inference requires 20 consecutive complete years"
                  : "No measured result to assess"}
            </p>
            <div className="metric-footer">
              Uncertainty matters
              <span className="amber">
                {!illustrative && stats.interval ? "CONDITIONAL" : "NO CLAIM"}
              </span>
            </div>
          </article>
        </section>
          <section className="card trend-card" id="trends">
            <div className="card-heading">
              <div>
                <h2>{selected.name} vegetation trend</h2>
                <p>
                  {start}–{end} · monthly {index} ·{" "}
                  {illustrative
                    ? "synthetic demo"
                    : rows.length
                      ? "quality-filtered observations"
                      : "no observations connected"}
                </p>
              </div>
              <span className="pill">
                {index} <ChevronDown size={12} />
              </span>
            </div>
            {rows.length ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#285B47"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#285B47"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#E3E4DB"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="date"
                      minTickGap={70}
                      tickFormatter={(v) => v.slice(0, 4)}
                      stroke="#5C6C63"
                      fontSize={10}
                    />
                    <YAxis
                      domain={[-0.2, 1]}
                      stroke="#5C6C63"
                      fontSize={10}
                      width={35}
                    />
                    <Tooltip contentStyle={chartStyle} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={`${index} (${illustrative ? "synthetic" : "measured"})`}
                      stroke="#285B47"
                      fill="url(#green)"
                      strokeWidth={1.7}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty onClick={() => setIllustrative(true)} />
            )}
            <div className="chart-note">
              <i className="dot" />
              {illustrative
                ? "Illustrative data · not NASA measurements"
                : rows.length
                  ? "MOD13Q1.061 · operator-provided provenance"
                  : "MODIS observations required"}
              <span>No interpolation · unitless index</span>
            </div>
          </section>
          <section className="card seasonal-card">
            <div className="card-heading">
              <div>
                <h2>Seasonal profile</h2>
                <p>Seasonal profile · monthly mean {index}</p>
              </div>
              <span className="pill">JAN — DEC</span>
            </div>
            {rows.length ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={season}>
                    <CartesianGrid vertical={false} stroke="#E3E4DB" />
                    <XAxis dataKey="month" stroke="#5C6C63" fontSize={10} />
                    <YAxis
                      domain={[-0.2, 1]}
                      stroke="#5C6C63"
                      fontSize={10}
                      width={30}
                    />
                    <Tooltip contentStyle={chartStyle} />
                    <Bar
                      dataKey="value"
                      name={`${illustrative ? "Synthetic" : "Measured"} ${index}`}
                      fill="#60856C"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty compact onClick={() => setIllustrative(true)} />
            )}
            <div className="chart-note">
              Monsoons, crop cycles and clouds can affect greenness.
            </div>
          </section>
          <section className="card comparison-card" id="regions">
            <div className="card-heading">
              <div>
                <h2>Bangladesh to the world</h2>
                <p>Compare study points using the same period and index</p>
              </div>
              <Layers size={18} />
            </div>
            <div className="region-chips">
              {regions.slice(1).map((r) => (
                <button
                  key={r.id}
                  className={comparisons.includes(r.id) ? "included" : ""}
                  onClick={() =>
                    setComparisons(
                      comparisons.includes(r.id)
                        ? comparisons.filter((x) => x !== r.id)
                        : [...comparisons, r.id],
                    )
                  }
                >
                  {comparisons.includes(r.id) && <Check size={12} />}
                  <i style={{ background: r.color }} />
                  {r.name}
                </button>
              ))}
            </div>
            {rows.length ? (
              <div className="chart comparison-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.map((r, i) => ({
                      date: r.date,
                      ...Object.fromEntries(
                        regions
                          .filter(
                            (r) =>
                              r.id === region || comparisons.includes(r.id),
                          )
                          .map((r) => [
                            r.id,
                            illustrative
                              ? demo(regions.indexOf(r), index).filter(
                                  (x) =>
                                    +x.date.slice(0, 4) >= start &&
                                    +x.date.slice(0, 4) <= end,
                                )[i]?.value
                              : monthly(
                                  measured.find(
                                    (s) =>
                                      s.region === r.id && s.index === index,
                                  )?.observations || [],
                                ).find((x) => x.date === data[i].date)?.value,
                          ]),
                      ),
                    }))}
                  >
                    <CartesianGrid vertical={false} stroke="#E3E4DB" />
                    <XAxis
                      dataKey="date"
                      minTickGap={80}
                      tickFormatter={(v) => v.slice(0, 4)}
                      stroke="#5C6C63"
                      fontSize={10}
                    />
                    <YAxis
                      domain={[-0.2, 1]}
                      stroke="#5C6C63"
                      fontSize={10}
                      width={35}
                    />
                    <Tooltip contentStyle={chartStyle} />
                    {regions
                      .filter(
                        (r) => r.id === region || comparisons.includes(r.id),
                      )
                      .map((r) => (
                        <Line
                          key={r.id}
                          dataKey={r.id}
                          name={r.name + (illustrative ? " (demo)" : "")}
                          stroke={r.color}
                          dot={false}
                          strokeWidth={1.5}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty compact onClick={() => setIllustrative(true)} />
            )}
            <div className="chart-note">
              Different climates and land uses limit direct comparisons.{" "}
              {illustrative
                ? "All demo curves are synthetic."
                : "Missing periods are not interpolated."}
            </div>
          </section>
          <section className="card scientist-card" id="scientist">
            <div className="card-heading">
              <div>
                <h2>
                  <Sparkles size={18} /> Explain this result
                </h2>
                <p>Reference guidance for your current study selection.</p>
              </div>
              <span className="new">SCIENCE FIRST</span>
            </div>
            <p className="scientist-intro">
              Questions about the evidence?
              <br />
              <span>Explore the method and its limits.</span>
            </p>
            <div className="prompts">
              {[
                "What does NDVI tell us?",
                "How reliable is this trend?",
                "Could seasons affect the result?",
              ].map((q) => (
                <button
                  disabled={busy}
                  key={q}
                  onClick={() => {
                    setQuestion(q);
                    ask(q);
                  }}
                >
                  {q}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            {answer &&
              answerSelection ===
                JSON.stringify([region, index, start, end, illustrative]) && (
                <div className="answer" role="status">
                  {answer}
                </div>
              )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <input
                aria-label="Ask Earth scientist"
                placeholder="Ask about the science…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={600}
              />
              <button disabled={busy} aria-label="Submit question">
                {busy ? "…" : <ArrowRight size={19} />}
              </button>
            </form>
            <small>
              Answers distinguish evidence, interpretations and unknowns.
            </small>
          </section>
          <AnalysisPanels
            series={
              illustrative
                ? regions.map((r, i) => ({
                    region: r.id,
                    index,
                    observations: demo(i, index),
                  }))
                : measured
            }
            rows={rows}
            fullRows={fullRows}
            region={region}
            index={index}
            start={start}
            end={end}
            demo={illustrative}
            comparisons={comparisons}
          />
          <section className="card climate-card">
            <div className="card-heading">
              <div>
                <h2>Climate adds context</h2>
                <p>NASA POWER · selected point · {end}</p>
              </div>
              <button
                className="secondary"
                disabled={climateBusy}
                onClick={loadClimate}
              >
                {climateBusy ? "Loading…" : "Load climate"} <ArrowDownIcon />
              </button>
            </div>
            {climate &&
            climate.requestRegion === region &&
            climate.requestYear === end ? (
              <div className="climate-result">
                {"error" in climate ? (
                  <p role="alert">{String(climate.error)}</p>
                ) : (
                  <>
                    <p className="mint">
                      NASA POWER response received for {selected.name}.
                    </p>
                    <ClimateChart
                      year={end}
                      parameter={
                        (
                          climate.properties as {
                            parameter: Record<string, Record<string, number>>;
                          }
                        ).parameter
                      }
                    />
                    <div className="climate-months">
                      {Object.entries(
                        (
                          climate.properties as {
                            parameter: Record<string, Record<string, number>>;
                          }
                        ).parameter.T2M || {},
                      )
                        .filter(([k]) => k.slice(4) !== "13")
                        .map(([k, v]) => (
                          <span key={k}>
                            <small>
                              {k.slice(0, 4)}-{k.slice(4)}
                            </small>
                            <b>
                              {v === -999 ? "Missing" : `${v.toFixed(1)}°C`}
                            </b>
                          </span>
                        ))}
                    </div>
                    <details>
                      <summary>Precipitation and source units</summary>
                      <pre>
                        {JSON.stringify(
                          {
                            parameters: climate.parameters,
                            precipitation: (
                              climate.properties as { parameter: unknown }
                            ).parameter,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            ) : (
              <p className="climate-explain">
                Explore monthly temperature and precipitation alongside
                vegetation. Climate is supporting evidence; correlation does not
                establish cause.
              </p>
            )}
          </section>
        </div>
        <section className="methodology" id="methodology">
          <div>
            <div className="eyebrow">BUILT ON TRANSPARENT SCIENCE</div>
            <h2>The method behind the map.</h2>
            <p>
              Vegetation indices tell part of Earth’s story. Good science makes
              its limits visible.
            </p>
          </div>
          <div className="method-grid">
            <article>
              <b>01 / Quality before quantity</b>
              <p>
                MOD13Q1.061 raw values use a 0.0001 scale factor; −3000 is fill.
                Strict DetailedQA excludes poor usefulness, clouds, high
                aerosol, snow and shadow. Valid range: −0.2 to 1.
              </p>
            </article>
            <article>
              <b>02 / Trends need context</b>
              <p>
                Monthly means use valid observations without interpolation.
                Descriptive OLS uses complete 12-month years, requiring at least
                five. Exploratory approximate 95% Newey–West intervals require
                20 consecutive complete years and nondegenerate residuals.
                Direction is supported only when the interval excludes zero;
                assumptions and multiple-comparison limits remain visible.
              </p>
            </article>
            <article>
              <b>03 / Avoid overinterpretation</b>
              <p>
                NDVI alone cannot prove deforestation, recovery or causation.
                Anomalies use calendar-month baseline z-scores (2001–2010, at
                least five values); |z| ≥ 2 flags an unusual observation, not a
                disaster.
              </p>
            </article>
          </div>
        </section>
        <section className="sources" id="sources">
          <div>
            <Database size={22} />
            <h2>Trace every signal to its source.</h2>
          </div>
          <p>
            {datasetStatus} AppEEARS requires Earthdata authentication and
            processed observation import. Measured point layers do not represent
            spatial coverage; regional raster processing remains pending.
            Bangladesh outline: geoBoundaries gbOpen, 2015, CC0, for geographic
            context (not an official legal boundary).
          </p>
          <div className="source-links">
            <a
              href="https://modis.gsfc.nasa.gov/data/dataprod/mod13.php"
              target="_blank"
              rel="noreferrer"
            >
              MODIS vegetation indices <ArrowUpRight size={14} />
            </a>
            <a
              href="https://appeears.earthdatacloud.nasa.gov/api/"
              target="_blank"
              rel="noreferrer"
            >
              AppEEARS API <ArrowUpRight size={14} />
            </a>
            <a
              href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/"
              target="_blank"
              rel="noreferrer"
            >
              NASA POWER <ArrowUpRight size={14} />
            </a>
            <a
              href="https://nasa-gibs.github.io/gibs-api-docs/"
              target="_blank"
              rel="noreferrer"
            >
              NASA GIBS <ArrowUpRight size={14} />
            </a>
            <a
              href="https://search.earthdata.nasa.gov/search?q=MOD13Q1"
              target="_blank"
              rel="noreferrer"
            >
              Earthdata Search <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
        <footer>
          <span>
            <Globe2 size={16} /> TerraScope{" "}
            <span className="muted">/ Bangladesh to the World</span>
          </span>
          <span>Explore responsibly. Understand our planet.</span>
        </footer>
      </main>
    </>
  );
}
function Empty({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <div className={"empty " + (compact ? "compact" : "")}>
      <ChartNoAxesCombined size={30} />
      <b>A clear view starts with good data.</b>
      <p>Validated vegetation observations are not connected.</p>
      <button onClick={onClick}>
        Explore illustrative demo <ArrowRight size={13} />
      </button>
    </div>
  );
}
function ArrowDownIcon() {
  return <ChevronDown size={13} />;
}
