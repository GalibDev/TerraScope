"use client";
import { climateMonths } from "@/lib/climate";
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
  const data = climateMonths(year, parameter);
  return (
    <div className="chart climate-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 14, right: 14, top: 15 }}>
          <CartesianGrid vertical={false} stroke="#E3E4DB" />
          <XAxis dataKey="month" stroke="#5C6C63" fontSize={10} />
          <YAxis
            yAxisId="temperature"
            stroke="#A87532"
            fontSize={10}
            label={{
              value: "°C",
              angle: -90,
              position: "insideLeft",
              fill: "#A87532",
              fontSize: 10,
            }}
          />
          <YAxis
            yAxisId="rain"
            orientation="right"
            stroke="#4B768D"
            fontSize={10}
            label={{
              value: "mm/day",
              angle: 90,
              position: "insideRight",
              fill: "#4B768D",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#FDFCF8",
              border: "1px solid #DCDDD4",
              color: "#202C29",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar
            dataKey="precipitation"
            yAxisId="rain"
            name="Precipitation (mean mm/day)"
            fill="#4B768D"
            radius={[3, 3, 0, 0]}
          />
          <Line
            dataKey="temperature"
            yAxisId="temperature"
            name="Temperature (°C)"
            stroke="#A87532"
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
