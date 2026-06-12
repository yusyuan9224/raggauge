"use client";

import { useState } from "react";
import {
  ConfigResult,
  QuestionResult,
  configLabel,
  METRIC_COLORS,
  METRIC_LABELS,
} from "@/lib/types";
import { MetricsBarChart } from "@/components/charts/MetricsBarChart";
import { LatencyScatterChart } from "@/components/charts/LatencyScatterChart";
import { MetricsRadarChart } from "@/components/charts/MetricsRadarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Download, Trophy, ChevronRight } from "lucide-react";

interface Props {
  results: ConfigResult[];
}

const METRIC_KEYS = [
  "retrieval_recall",
  "context_precision",
  "faithfulness",
  "answer_correctness",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];

function fmt(v: number | null): string {
  if (v === null) return "n/a";
  return v.toFixed(3);
}

function fmtMs(v: number): string {
  return `${v.toFixed(0)} ms`;
}

export function ExperimentResults({ results }: Props) {
  // Find best value per metric column
  const bestValues: Record<MetricKey, number> = {} as Record<MetricKey, number>;
  for (const key of METRIC_KEYS) {
    const vals = results
      .map((r) => r[key] as number | null)
      .filter((v): v is number => v !== null);
    bestValues[key] = vals.length > 0 ? Math.max(...vals) : -Infinity;
  }
  const bestLatency = Math.min(
    ...results.map((r) => r.avg_retrieval_ms + r.avg_generation_ms)
  );

  // Best overall (correctness primary, faithfulness secondary)
  const bestResult = results
    .slice()
    .sort((a, b) => {
      const ca = a.answer_correctness ?? -1;
      const cb = b.answer_correctness ?? -1;
      if (Math.abs(ca - cb) > 0.001) return cb - ca;
      return (b.faithfulness ?? -1) - (a.faithfulness ?? -1);
    })[0];

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(bestResult.config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `best-config-${configLabel(bestResult.config)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Best config card */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Trophy className="h-4 w-4 text-amber-500" />
            最佳組合
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <p className="font-mono text-sm font-medium text-amber-900">
              {configLabel(bestResult.config)}
            </p>
            <div className="flex flex-wrap gap-2">
              {METRIC_KEYS.map((key) => {
                const v = bestResult[key] as number | null;
                return (
                  <span key={key} className="text-xs text-amber-700">
                    <span className="text-amber-500">
                      {METRIC_LABELS[key]}
                    </span>{" "}
                    {fmt(v)}
                  </span>
                );
              })}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-amber-200 text-amber-800 hover:bg-amber-100 flex-shrink-0"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            匯出設定 JSON
          </Button>
        </CardContent>
      </Card>

      {/* Overview table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">總覽表格</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-xs w-[180px]">設定</TableHead>
                  {METRIC_KEYS.map((key) => (
                    <TableHead key={key} className="text-xs font-semibold">
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: METRIC_COLORS[key] }}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: METRIC_COLORS[key] }}
                        />
                        {METRIC_LABELS[key]}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    延遲 (ms)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const totalMs = r.avg_retrieval_ms + r.avg_generation_ms;
                  return (
                    <TableRow key={configLabel(r.config)}>
                      <TableCell className="font-mono text-xs font-medium">
                        {configLabel(r.config)}
                      </TableCell>
                      {METRIC_KEYS.map((key) => {
                        const v = r[key] as number | null;
                        const isBest =
                          v !== null && Math.abs(v - bestValues[key]) < 0.0001;
                        return (
                          <TableCell
                            key={key}
                            className={`text-xs tabular-nums ${
                              isBest
                                ? "bg-emerald-50 text-emerald-700 font-semibold"
                                : ""
                            }`}
                          >
                            {fmt(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={`text-xs tabular-nums ${
                          Math.abs(totalMs - bestLatency) < 1
                            ? "bg-emerald-50 text-emerald-700 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {fmtMs(totalMs)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
            綠底 = 該欄最佳值
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">圖表分析</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bar">
            <TabsList className="mb-4">
              <TabsTrigger value="bar" className="text-xs">分組長條圖</TabsTrigger>
              <TabsTrigger value="scatter" className="text-xs">延遲散點圖</TabsTrigger>
              <TabsTrigger value="radar" className="text-xs">雷達圖比較</TabsTrigger>
            </TabsList>
            <TabsContent value="bar">
              <MetricsBarChart results={results} />
            </TabsContent>
            <TabsContent value="scatter">
              <LatencyScatterChart results={results} />
            </TabsContent>
            <TabsContent value="radar">
              <MetricsRadarChart results={results} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Per-question details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">逐題明細</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.map((r) => (
            <ConfigDetail key={configLabel(r.config)} result={r} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigDetail({ result }: { result: ConfigResult }) {
  const [open, setOpen] = useState(false);
  const label = configLabel(result.config);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
        <span className="font-mono text-xs font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {result.questions.length} 題
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-2">
          {result.questions.map((q, i) => (
            <QuestionDetail key={i} index={i + 1} question={q} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QuestionDetail({
  index,
  question: q,
}: {
  index: number;
  question: QuestionResult;
}) {
  const [showRetrieved, setShowRetrieved] = useState(false);
  const [showJudgeLog, setShowJudgeLog] = useState(false);

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </span>
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{q.question}</p>
          <p className="text-sm text-muted-foreground">{q.answer}</p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["召回率", q.retrieval_recall, METRIC_COLORS.retrieval_recall],
            ["精確度", q.context_precision, METRIC_COLORS.context_precision],
            ["忠實度", q.faithfulness, METRIC_COLORS.faithfulness],
            ["正確性", q.answer_correctness, METRIC_COLORS.answer_correctness],
          ] as [string, number | null, string][]
        ).map(([label, val, color]) => (
          <div
            key={label}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: `${color}40`, background: `${color}08` }}
          >
            <span style={{ color }} className="font-medium">{label}</span>
            <span className="ml-1 tabular-nums text-foreground">
              {val === null ? "n/a" : val.toFixed(3)}
            </span>
          </div>
        ))}
        <div className="rounded border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          檢索 {q.retrieval_ms.toFixed(0)} ms · 生成 {q.generation_ms.toFixed(0)} ms
        </div>
      </div>

      {/* Retrieved passages */}
      <Collapsible open={showRetrieved} onOpenChange={setShowRetrieved}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight
            className={`h-3 w-3 transition-transform ${showRetrieved ? "rotate-90" : ""}`}
          />
          檢回文段（{q.retrieved.length}）
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {q.retrieved.map((passage, i) => (
              <div
                key={i}
                className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-mono leading-relaxed"
              >
                <span className="text-foreground/40 mr-2">[{i + 1}]</span>
                {passage}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Judge log */}
      {q.judge_log && q.judge_log.length > 0 && (
        <Collapsible open={showJudgeLog} onOpenChange={setShowJudgeLog}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showJudgeLog ? "rotate-90" : ""}`}
            />
            Judge 日誌（{q.judge_log.length} 條）
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap">
              {q.judge_log.join("\n")}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
