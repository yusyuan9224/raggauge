"use client";

import { useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { ConfigResult, configLabel } from "@/lib/types";

interface Props {
  results: ConfigResult[];
}

const GRID = "oklch(0.28 0.012 250)";
const TICK = "oklch(0.65 0.01 250)";

// Series palette — no purple
const COLORS = [
  "oklch(0.75 0.12 210)", // cyan
  "oklch(0.78 0.14 80)", // amber
  "oklch(0.75 0.15 150)", // green
  "oklch(0.7 0.13 255)", // blue
  "oklch(0.7 0.14 25)", // red
  "oklch(0.8 0.12 110)", // lime
];

const AXES = [
  { key: "retrieval_recall", label: "召回率" },
  { key: "context_precision", label: "精確度" },
  { key: "faithfulness", label: "忠實度" },
  { key: "answer_correctness", label: "正確性" },
];

export function MetricsRadarChart({ results }: Props) {
  const [selected, setSelected] = useState<string[]>(
    results.slice(0, Math.min(3, results.length)).map((r) => configLabel(r.config))
  );

  const toggle = (label: string) => {
    setSelected((prev) =>
      prev.includes(label)
        ? prev.filter((x) => x !== label)
        : prev.length >= 4
        ? prev
        : [...prev, label]
    );
  };

  const radarData = AXES.map(({ key, label }) => {
    const entry: Record<string, string | number> = { metric: label };
    results.forEach((r) => {
      const lbl = configLabel(r.config);
      entry[lbl] = (r[key as keyof ConfigResult] as number | null) ?? 0;
    });
    return entry;
  });

  const activeResults = results.filter((r) => selected.includes(configLabel(r.config)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {results.map((r, i) => {
          const lbl = configLabel(r.config);
          const isSelected = selected.includes(lbl);
          return (
            <button
              key={lbl}
              onClick={() => toggle(lbl)}
              className={`rounded-sm border px-2 py-1 text-xs font-mono transition-colors ${
                isSelected
                  ? "text-background font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
              style={
                isSelected
                  ? {
                      background: COLORS[i % COLORS.length],
                      borderColor: COLORS[i % COLORS.length],
                    }
                  : {}
              }
            >
              {lbl}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground self-center ml-1">（最多 4 組）</span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 12, fill: TICK }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 1]}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: TICK }}
            stroke={GRID}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.205 0.012 250)",
              border: `1px solid ${GRID}`,
              borderRadius: 6,
              fontSize: 12,
              color: "oklch(0.92 0.005 250)",
            }}
            itemStyle={{ color: "oklch(0.92 0.005 250)" }}
            labelStyle={{ color: TICK }}
            formatter={(value) => [typeof value === "number" ? value.toFixed(3) : String(value)]}
          />
          {activeResults.map((r) => {
            const lbl = configLabel(r.config);
            const colorIdx = results.indexOf(r);
            return (
              <Radar
                key={lbl}
                name={lbl}
                dataKey={lbl}
                stroke={COLORS[colorIdx % COLORS.length]}
                fill={COLORS[colorIdx % COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            );
          })}
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: TICK }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
