"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Experiment, Dataset } from "@/lib/types";
import { HealthBadge } from "@/components/HealthBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { NewExperimentDialog } from "@/components/NewExperimentDialog";
import { formatDistanceToNow } from "@/lib/time";

function usePolledData() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .listExperiments()
      .then((data) => { if (!cancelled) setExperiments(data); })
      .catch(() => {});
    api
      .listDatasets()
      .then((data) => {
        if (!cancelled) {
          setDatasets(data);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = () => setTick((t) => t + 1);

  return { experiments, datasets, loading, refresh };
}

export default function HomePage() {
  const { experiments, datasets, loading, refresh } = usePolledData();

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
              RAGGauge
            </span>
            <span className="text-xs text-muted-foreground">RAG 評測儀表板</span>
          </div>
          <HealthBadge />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Readout strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-md border border-border bg-card divide-x divide-border">
          <Readout label="總實驗數" value={experiments.length} />
          <Readout label="資料集" value={datasets.length} />
          <Readout
            label="執行中"
            value={experiments.filter((e) => e.status === "running").length}
            valueClass="text-status-warn"
          />
          <Readout
            label="已完成"
            value={experiments.filter((e) => e.status === "done").length}
            valueClass="text-status-ok"
          />
        </div>

        {/* Experiments list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">實驗列表</h2>
            <NewExperimentDialog datasets={datasets} onCreated={refresh} />
          </div>

          {loading ? (
            <div className="rounded-md border border-border bg-card divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse" />
              ))}
            </div>
          ) : experiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-card py-16 text-center">
              <p className="text-sm text-muted-foreground">尚無實驗</p>
              <p className="text-xs text-muted-foreground/60">點擊「新建實驗」開始評測</p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[88px_minmax(0,1fr)_80px_120px_minmax(0,200px)] items-center gap-x-4 border-b border-border px-4 h-8 text-[11px] font-medium text-muted-foreground">
                <span>狀態</span>
                <span>名稱</span>
                <span className="text-right">設定數</span>
                <span className="text-right">建立時間</span>
                <span className="text-right">錯誤</span>
              </div>
              <div className="divide-y divide-border">
                {experiments
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((exp) => (
                    <ExperimentRow key={exp.id} experiment={exp} />
                  ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ExperimentRow({ experiment: exp }: { experiment: Experiment }) {
  return (
    <Link
      href={`/experiments/${exp.id}`}
      className="grid grid-cols-[88px_minmax(0,1fr)_80px_120px_minmax(0,200px)] items-center gap-x-4 px-4 h-11 transition-colors hover:bg-white/[0.03]"
    >
      <span>
        <StatusBadge status={exp.status} />
      </span>
      <span className="text-sm text-foreground truncate">{exp.name}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground text-right">
        {exp.num_configs}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground text-right whitespace-nowrap">
        {formatDistanceToNow(exp.created_at)}前
      </span>
      <span className="font-mono text-xs text-status-err truncate text-right">
        {exp.error ?? ""}
      </span>
    </Link>
  );
}

function Readout({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className={`font-mono text-2xl font-medium leading-none tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
