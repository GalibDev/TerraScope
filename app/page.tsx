"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
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
  Satellite,
  CloudDownload,
  CodeXml,
  Orbit,
  Network,
} from "lucide-react";
import { regions } from "@/lib/regions";
import { demo, monthly, seasonal, trend } from "@/lib/analysis";
import AnalysisPanels from "@/components/AnalysisPanels";
import type { MeasuredSeries } from "@/components/AnalysisPanels";
import { pointFeatures } from "@/lib/map-data";
import ClimateChart from "@/components/ClimateChart";
import { downloadBlob } from "@/lib/download";
const MapView = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map loading">Loading Earth imagery…</div>,
});
const SundarbansComparison = dynamic(
  () => import("@/components/SundarbansComparison"),
  { ssr: false },
);
const SentinelComparison = dynamic(
  () => import("@/components/SentinelComparison"),
  { ssr: false },
);
const links = [
  ["Overview", LayoutDashboard, "overview"],
  ["Interactive map", MapIcon, "map"],
  ["Sundarbans comparison", Layers, "sundarbans"],
  ["Sentinel-2 detailed view", MapIcon, "sentinel2"],
  ["Trend detective", ChartNoAxesCombined, "trends"],
  ["Region comparison", Layers, "regions"],
  ["Explain results", FlaskConical, "scientist"],
  ["Methodology", BookOpen, "methodology"],
  ["Data sources", Database, "sources"],
] as const;
export default function Home() {
  const [activeSection, setActiveSection] = useState("overview");
  useEffect(() => {
    const syncSection = () => {
      const id = window.location.hash.slice(1);
      setActiveSection(
        links.some(([, , section]) => section === id) ? id : "overview",
      );
    };
    syncSection();
    let frame = 0;
    const updateFromScroll = () => {
      frame = 0;
      const activationLine =
        (document.querySelector("header")?.getBoundingClientRect().bottom ??
          80) + 100;
      let selected = "overview";
      let closestTop = -Infinity;
      for (const [, , id] of links) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= activationLine && top >= closestTop) {
          selected = id;
          closestTop = top;
        }
      }
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 8
      )
        selected = "sources";
      setActiveSection(selected);
    };
    const scheduleScrollUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateFromScroll);
    };
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate);
    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleScrollUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, []);
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
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `terrascope-${region}-${index.toLowerCase()}-${start}-${end}-${illustrative ? "illustrative" : "measured"}.csv`,
    );
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
            <Image
              src="/brand/terrascope.svg"
              alt=""
              width={58}
              height={58}
              priority
            />
          </span>
          <span>
            Terra<span className="mint">Scope</span>
            <small>BANGLADESH TO THE WORLD</small>
          </span>
        </a>
        <nav>
          <a
            className={activeSection === "overview" ? "active" : ""}
            aria-current={activeSection === "overview" ? "location" : undefined}
            href="#overview"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <a
            className={activeSection === "map" ? "active" : ""}
            aria-current={activeSection === "map" ? "location" : undefined}
            href="#map"
          >
            <MapIcon size={20} />
            Explore map
          </a>
          <a
            className={activeSection === "trends" ? "active" : ""}
            aria-current={activeSection === "trends" ? "location" : undefined}
            href="#trends"
          >
            <ChartNoAxesCombined size={20} />
            Trends
          </a>
          <a
            className={activeSection === "methodology" ? "active" : ""}
            aria-current={
              activeSection === "methodology" ? "location" : undefined
            }
            href="#methodology"
          >
            <FlaskConical size={20} />
            About the science
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
        <div className="workspace-brand">
          <Image src="/brand/terrascope.svg" alt="" width={44} height={44} />
          <div>
            <b>TerraScope</b>
            <small>Workspace</small>
          </div>
        </div>
        {links.map(([label, Icon, id]) => (
          <a
            key={id}
            className={activeSection === id ? "selected" : ""}
            aria-current={activeSection === id ? "location" : undefined}
            href={`#${id}`}
            onClick={() => setNav(false)}
          >
            <Icon size={18} />
            {label}
            {id === "scientist" && <span className="new">AI</span>}
          </a>
        ))}
        <div className="sidebar-note">
          <Image
            className="sidebar-note-logo"
            src="/brand/terrascope.svg"
            alt="TerraScope"
            width={48}
            height={48}
          />
          <strong>
            Bangladesh,
            <br />
            in context.
          </strong>
          <p>
            Compare four study locations through a consistent scientific method.
          </p>
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
        <section
          className="forest-hero"
          aria-label="Earth observation introduction"
        >
          <div className="forest-hero-copy">
            <div className="hero-kicker">
              EARTH OBSERVATION FOR BANGLADESH <span />
            </div>
            <h2>
              Bangladesh, <em>in context.</em>
            </h2>
            <p>
              Compare four study locations through a
              <br className="hero-break" /> consistent scientific method.
            </p>
            <div className="hero-capabilities">
              <div>
                <Sparkles />
                <span>
                  <b>NASA MODIS</b>
                  <small>MOD13Q1 v6.1</small>
                </span>
              </div>
              <div>
                <Leaf />
                <span>
                  <b>NDVI / EVI</b>
                  <small>Vegetation indices</small>
                </span>
              </div>
              <div>
                <Layers />
                <span>
                  <b>Quality screening</b>
                  <small>Coverage & data gaps</small>
                </span>
              </div>
              <div>
                <Globe2 />
                <span>
                  <b>Bangladesh</b>
                  <small>Study focus</small>
                </span>
              </div>
            </div>
          </div>
        </section>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> EARTH OBSERVATION ATLAS
            </div>
            <h1>
              <span className="title-leaf">
                <Leaf size={30} />
              </span>
              Vegetation change
              <span className="heading-period">
                {start}—{end}
              </span>
            </h1>
            <p>
              {selected.name} · MODIS vegetation indices · Quality, coverage and
              uncertainty.
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
            <div
              className="study-visual"
              role="img"
              aria-label="Decorative forest illustration"
            />
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
                  ? (
                      data.reduce((s, r) => s + r.value, 0) / data.length
                    ).toFixed(3)
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
          <SundarbansComparison />
          <SentinelComparison />
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
                  <Sparkles size={18} /> ফলাফল সহজ ভাষায়
                </h2>
                <p>
                  {selected.name} · {start}–{end} · {index} · নির্বাচিত study
                  point
                </p>
              </div>
              <span className="new">SCIENCE FIRST</span>
            </div>
            <div className="plain-result" aria-live="polite">
              <h3>
                {illustrative
                  ? "এটি শুধু demo — বাস্তব ফল নয়"
                  : datasetStatus === "Loading dataset status…"
                    ? "NASA data লোড হচ্ছে — একটু অপেক্ষা করুন"
                    : !rows.length
                      ? "এই সময়ে ব্যবহারযোগ্য data পাওয়া যায়নি"
                      : stats.classification === "Greening"
                        ? "এই study point-এ সবুজের সূচক বাড়ার প্রবণতা আছে"
                        : stats.classification === "Browning"
                          ? "এই study point-এ সবুজের সূচক কমার প্রবণতা আছে"
                          : stats.classification ===
                              "No clear directional trend"
                            ? "বাড়া বা কমার স্পষ্ট প্রবণতা পাওয়া যায়নি"
                            : "সবুজ বেড়েছে না কমেছে — এখনও নিশ্চিত বলা যাচ্ছে না"}
              </h3>
              <p>
                {illustrative
                  ? "Measured data চালু করলে NASA-র প্রকৃত observations দেখতে পাবেন।"
                  : `${rows.length}টি quality-filtered observation পাওয়া গেছে। এর মধ্যে ${stats.n}টি বছরের সব ১২ মাসের data আছে।`}
              </p>
              <p>
                {illustrative
                  ? "Demo-র সংখ্যা দিয়ে পরিবেশ সম্পর্কে সিদ্ধান্ত নেবেন না।"
                  : stats.classification === "Insufficient data"
                    ? "Data থাকলেও দীর্ঘমেয়াদি সিদ্ধান্তের জন্য প্রয়োজনীয় পূর্ণ বছর ও uncertainty checks যথেষ্ট নয়। এর মানে গাছ নেই বা পরিবর্তন হয়নি—এমন নয়।"
                    : "এটি সবুজের সূচকের ফল। গাছের সংখ্যা, বনভূমির পরিবর্তন বা পরিবর্তনের কারণ সরাসরি বোঝায় না।"}
              </p>
              <a href="#sundarbans">সুন্দরবনের আগে ও পরের ফল দেখুন →</a>
            </div>
            <p className="scientist-intro">
              আরও জানতে চান? নিচে প্রশ্ন বেছে নিন।
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
        <section className="methodology science-workspace" id="methodology">
          <div className="science-hero">
            <div className="eyebrow">METHODOLOGY</div>
            <h2>
              The method behind <span>TerraScope</span>
            </h2>
            <p>
              A transparent and reproducible approach to explore vegetation
              change using NASA Earth observation data.
            </p>
            <div className="science-badges">
              <span>
                <Globe2 /> NASA MODIS
              </span>
              <span>
                <Leaf /> NDVI & EVI
              </span>
              <span>
                <Check /> Quality screened
              </span>
              <span>
                <Layers /> Transparent methods
              </span>
            </div>
          </div>
          <section className="science-workflow science-card">
            <h3>
              <Layers /> Our analysis workflow
            </h3>
            <p>From satellite observations to understandable results.</p>
            <ol>
              {[
                ["Acquire data", "NASA MODIS via AppEEARS", Database],
                [
                  "Screen observations",
                  "Check quality flags and missing data",
                  Check,
                ],
                ["Read indices", "Use product NDVI / EVI values", Leaf],
                [
                  "Compare & analyze",
                  "Match months and check coverage",
                  ChartNoAxesCombined,
                ],
                [
                  "Visualize & explore",
                  "Maps, trends and pixel inspection",
                  MapIcon,
                ],
              ].map(([title, text, Icon], i) => {
                const StepIcon = Icon as typeof Database;
                return (
                  <li key={title as string}>
                    <span className="science-step-icon">
                      <StepIcon />
                    </span>
                    <div>
                      <b>
                        {i + 1}. {title as string}
                      </b>
                      <small>{text as string}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <div className="science-columns">
            <article className="science-card">
              <h3>
                <Database /> Dataset at a glance
              </h3>
              <p>The core vegetation product used in TerraScope.</p>
              <dl>
                {[
                  ["NASA product", "MOD13Q1 v6.1"],
                  ["What it provides", "NDVI and EVI"],
                  ["Spatial resolution", "Nominal 250 meters"],
                  ["Source cadence", "16-day composite"],
                  ["Accessed via", "AppEEARS / Earthdata"],
                  ["Pilot area", "Small window near Sundarbans East"],
                  ["Pilot periods", "2001–2005 vs 2020–2024"],
                  ["Matching months", "Jan, Feb, Nov, Dec"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
            <article className="science-card">
              <h3>
                <Leaf /> Vegetation indices
              </h3>
              <p>Indicators of vegetation greenness, not tree counts.</p>
              <div className="science-index">
                <Leaf />
                <div>
                  <h4>NDVI</h4>
                  <p>Normalized Difference Vegetation Index</p>
                  <code>(NIR − Red) / (NIR + Red)</code>
                </div>
              </div>
              <div className="science-index">
                <Layers />
                <div>
                  <h4>EVI</h4>
                  <p>Enhanced Vegetation Index</p>
                  <code>
                    2.5 × (NIR − Red) /<br />
                    (NIR + 6 × Red − 7.5 × Blue + 1)
                  </code>
                </div>
              </div>
              <p className="science-footnote">
                NIR means near-infrared reflectance. TerraScope reads NASA’s
                supplied index layers; these formulas explain the indices,
                rather than a new calculation performed in the browser.
              </p>
            </article>
            <article className="science-card">
              <h3>
                <Check /> Data quality & screening
              </h3>
              <p>Make observation quality visible.</p>
              <ul className="science-checks">
                <li>Use the product’s DetailedQA flags</li>
                <li>Exclude unsuitable clouds, snow and shadow</li>
                <li>Display missing observations without filling gaps</li>
                <li>Report paired coverage and seasonal years</li>
                <li>Disclose screening assumptions</li>
              </ul>
              <p>
                <b>Two distinct policies</b>
                <br />
                Study points use strict QA. The Sundarbans raster uses an
                explicitly exploratory policy that allows intermediate aerosol
                after other checks; strict QA retains zero paired pixels.
              </p>
            </article>
          </div>
          <div className="science-bottom">
            <article className="science-card science-limits">
              <h3>
                <FlaskConical /> Key assumptions & limitations
              </h3>
              <ul>
                <li>
                  The pilot does not establish tree counts or forest-area change
                  across the whole Sundarbans.
                </li>
                <li>
                  The study window is an analyst-defined rectangle, not an
                  official sanctuary boundary.
                </li>
                <li>
                  Only 7.5% of the native raster footprint has paired data; this
                  denominator includes water and excluded cells.
                </li>
                <li>
                  Matching months reduce seasonal mismatch, but tides, mixed
                  pixels and QA choices still matter.
                </li>
              </ul>
            </article>
            <article className="science-card">
              <h3>
                <Network /> Reproducibility & sources
              </h3>
              <p>Explore the data, methods and code.</p>
              <div className="science-resources">
                {[
                  [
                    "MOD13Q1 v6.1",
                    "Product information",
                    "https://modis.gsfc.nasa.gov/data/dataprod/mod13.php",
                    Satellite,
                  ],
                  [
                    "AppEEARS",
                    "Data access",
                    "https://appeears.earthdatacloud.nasa.gov/",
                    CloudDownload,
                  ],
                  [
                    "Source code",
                    "GitHub",
                    "https://github.com/GalibDev/TerraScope",
                    CodeXml,
                  ],
                  [
                    "Earthdata",
                    "Search",
                    "https://search.earthdata.nasa.gov/search?q=MOD13Q1",
                    Orbit,
                  ],
                ].map(([label, description, url, Icon]) => {
                  const LinkIcon = Icon as typeof Globe2;
                  return (
                    <a
                      key={label as string}
                      href={url as string}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="resource-icon">
                        <LinkIcon strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <b>{label as string}</b>
                      <small>{description as string} ↗</small>
                    </a>
                  );
                })}
              </div>
            </article>
          </div>
          <details className="science-card science-technical">
            <summary>Technical processing details</summary>
            <p>
              Raw raster indices use scale 0.0001 and fill −3000; AppEEARS point
              exports are already scaled. NDVI/EVI valid range is −0.2 to 1. No
              second scaling is applied to point exports.
            </p>
            <p>
              Point trends use equal-weight monthly means and complete 12-month
              years: at least five for descriptive OLS, and 20 consecutive
              complete years with nondegenerate residuals for exploratory
              approximate 95% Newey–West intervals. Direction requires an
              interval excluding zero; assumptions and multiple-comparison
              limits remain visible.
            </p>
            <p>
              Sundarbans seasonal means give equal weight to the four matching
              months, require all four per year and at least three complete
              seasonal years per period. Only paired pixels contribute. Display
              reprojection uses nearest neighbour; downloadable scientific grids
              retain the native projection.
            </p>
            <p>
              Anomalies use calendar-month baseline z-scores for 2001–2010, with
              at least five baseline values and nonzero variance. |z| ≥ 2 flags
              an unusual observation, not a disaster or its cause.
            </p>
          </details>
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
