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

export function LatencyScatterChart({ results }: Props) {
  const data = results.map((r) => ({
    name: configLabel(r.config),
    totalMs: r.avg_retrieval_ms + r.avg_generation_ms,
    correctness: r.answer_correctness ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis
          dataKey="totalMs"
          name="總延遲 (ms)"
          type="number"
          tick={{ fontSize: 11, fill: "#64748B" }}
          label={{
            value: "總延遲 (ms)",
            position: "insideBottomRight",
            offset: -4,
            fontSize: 11,
            fill: "#94A3B8",
          }}
        />
        <YAxis
          dataKey="correctness"
          name="答案正確性"
          domain={[0, 1]}
          tick={{ fontSize: 11, fill: "#64748B" }}
          label={{
            value: "答案正確性",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: "#94A3B8",
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            fontSize: 12,
          }}
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
            style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", fill: "#64748B" }}
          />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
