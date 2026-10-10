"use client";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
export default function ClimateChart({
  year,
  parameter,
}: {
  year: number;
  parameter: Record<string, Record<string, number>>;
}) {
  const data = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}${String(i + 1).padStart(2, "0")}`;
    const t = parameter.T2M?.[key],
      p = parameter.PRECTOTCORR?.[key];
    return {
      month: new Date(2000, i).toLocaleString("en", { month: "short" }),
      temperature: t === undefined || t === -999 ? null : t,
      precipitation: p === undefined || p === -999 ? null : p,
    };
  });
  return (
    <div className="chart climate-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 14, right: 14, top: 15 }}>
          <CartesianGrid vertical={false} stroke="#20353e" />
          <XAxis dataKey="month" stroke="#7b939c" fontSize={10} />
          <YAxis
            yAxisId="temperature"
            stroke="#d9b57b"
            fontSize={10}
            label={{
              value: "°C",
              angle: -90,
              position: "insideLeft",
              fill: "#d9b57b",
              fontSize: 10,
            }}
          />
          <YAxis
            yAxisId="rain"
            orientation="right"
            stroke="#86b7d7"
            fontSize={10}
            label={{
              value: "mm/day",
              angle: 90,
              position: "insideRight",
              fill: "#86b7d7",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#10232c",
              border: "1px solid #29404b",
              color: "#e7f5f2",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar
            dataKey="precipitation"
            yAxisId="rain"
            name="Precipitation (mean mm/day)"
            fill="#537d9d"
            radius={[3, 3, 0, 0]}
          />
          <Line
            dataKey="temperature"
            yAxisId="temperature"
            name="Temperature (°C)"
            stroke="#d9b57b"
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
