"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { ConfigResult, configLabel, METRIC_COLORS } from "@/lib/types";

interface Props {
  results: ConfigResult[];
}

const GRID = "oklch(0.28 0.012 250)";
const TICK = "oklch(0.65 0.01 250)";

export function LatencyScatterChart({ results }: Props) {
  const data = results.map((r) => ({
    name: configLabel(r.config),
    totalMs: r.avg_retrieval_ms + r.avg_generation_ms,
    correctness: r.answer_correctness ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis
          dataKey="totalMs"
          name="總延遲 (ms)"
          type="number"
          tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
          stroke={GRID}
          label={{
            value: "總延遲 (ms)",
            position: "insideBottomRight",
            offset: -4,
            fontSize: 11,
            fill: TICK,
          }}
        />
        <YAxis
          dataKey="correctness"
          name="答案正確性"
          domain={[0, 1]}
          tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
          stroke={GRID}
          label={{
            value: "答案正確性",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: TICK,
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: GRID }}
          contentStyle={{
            background: "oklch(0.205 0.012 250)",
            border: `1px solid ${GRID}`,
            borderRadius: 6,
            fontSize: 12,
            color: "oklch(0.92 0.005 250)",
          }}
          itemStyle={{ color: "oklch(0.92 0.005 250)" }}
          labelStyle={{ color: TICK }}
          formatter={(value, name) => [
            typeof value === "number"
              ? name === "correctness"
                ? value.toFixed(3)
                : `${value.toFixed(0)} ms`
              : String(value),
            name === "correctness" ? "答案正確性" : "總延遲",
          ]}
        />
        <Scatter data={data} fill={METRIC_COLORS.answer_correctness}>
          <LabelList
            dataKey="name"
            position="top"
            style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
          />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
