"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ConfigResult, configLabel, METRIC_COLORS, METRIC_LABELS } from "@/lib/types";

interface Props {
  results: ConfigResult[];
}

const GRID = "oklch(0.28 0.012 250)";
const TICK = "oklch(0.65 0.01 250)";

export function MetricsBarChart({ results }: Props) {
  const data = results.map((r) => ({
    name: configLabel(r.config),
    recall: r.retrieval_recall ?? 0,
    precision: r.context_precision ?? 0,
    faithfulness: r.faithfulness ?? 0,
    correctness: r.answer_correctness ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
          stroke={GRID}
          angle={-40}
          textAnchor="end"
          interval={0}
          height={72}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
          stroke={GRID}
          tickCount={6}
        />
        <Tooltip
          cursor={{ fill: "oklch(0.92 0.005 250 / 0.04)" }}
          contentStyle={{
            background: "oklch(0.205 0.012 250)",
            border: `1px solid ${GRID}`,
            borderRadius: 6,
            fontSize: 12,
            color: "oklch(0.92 0.005 250)",
          }}
          itemStyle={{ color: "oklch(0.92 0.005 250)" }}
          labelStyle={{ color: TICK, fontFamily: "JetBrains Mono, monospace" }}
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(3) : String(value),
            METRIC_LABELS[name as keyof typeof METRIC_LABELS] ?? name,
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: TICK }}
          formatter={(value) =>
            METRIC_LABELS[value as keyof typeof METRIC_LABELS] ?? value
          }
        />
        <Bar dataKey="recall" fill={METRIC_COLORS.retrieval_recall} radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="precision" fill={METRIC_COLORS.context_precision} radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="faithfulness" fill={METRIC_COLORS.faithfulness} radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="correctness" fill={METRIC_COLORS.answer_correctness} radius={[2, 2, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
