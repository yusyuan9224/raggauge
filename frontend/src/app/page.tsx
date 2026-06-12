"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Experiment, Dataset } from "@/lib/types";
import { HealthBadge } from "@/components/HealthBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { NewExperimentDialog } from "@/components/NewExperimentDialog";
import { formatDistanceToNow } from "@/lib/time";
import { ChevronRight, FlaskConical, Database } from "lucide-react";

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
      {/* Top nav */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">RAGGauge</h1>
              <p className="text-xs text-muted-foreground mt-0.5">RAG 評測儀表板</p>
            </div>
          </div>
          <HealthBadge />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard
            icon={<FlaskConical className="h-4 w-4" />}
            label="總實驗數"
            value={experiments.length}
          />
          <SummaryCard
            icon={<Database className="h-4 w-4" />}
            label="資料集"
            value={datasets.length}
          />
          <SummaryCard
            icon={null}
            label="執行中"
            value={experiments.filter((e) => e.status === "running").length}
            valueColor="text-sky-600"
          />
          <SummaryCard
            icon={null}
            label="已完成"
            value={experiments.filter((e) => e.status === "done").length}
            valueColor="text-emerald-600"
          />
        </div>

        {/* Experiments list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">實驗列表</h2>
            <NewExperimentDialog datasets={datasets} onCreated={refresh} />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border border-border bg-card animate-pulse"
                />
              ))}
            </div>
          ) : experiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card py-16 text-center">
              <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">尚無實驗</p>
              <p className="text-xs text-muted-foreground/60">點擊「新建實驗」開始評測</p>
            </div>
          ) : (
            <div className="space-y-2">
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
      className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-all hover:border-foreground/20 hover:shadow-sm group"
    >
      <div className="flex items-center gap-4 min-w-0">
        <StatusBadge status={exp.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{exp.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {exp.num_configs} 組設定 · {formatDistanceToNow(exp.created_at)}前
          </p>
        </div>
      </div>
      {exp.error && (
        <p className="text-xs text-red-600 max-w-[200px] truncate mr-4">{exp.error}</p>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueColor = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
