"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ExperimentDetail } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ExperimentResults } from "@/components/ExperimentResults";
import { ArrowLeft, Loader2 } from "lucide-react";

function useExperimentData(id: string) {
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connectSSE() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(api.experimentEventsUrl(id));
      esRef.current = es;

      es.addEventListener("progress", (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data) as { message: string };
          setProgressMessages((prev) => [...prev, data.message]);
        } catch {
          // ignore
        }
      });

      function handleFinish() {
        es.close();
        esRef.current = null;
        if (cancelled) return;
        api
          .getExperiment(id)
          .then((data) => {
            if (cancelled) return;
            setExperiment(data);
            if (data.progress) setProgressMessages(data.progress);
          })
          .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "載入失敗");
          });
      }

      es.addEventListener("done", handleFinish);
      es.addEventListener("error", (e) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse((e as MessageEvent).data ?? "{}") as { status?: string };
          if (parsed.status) {
            setProgressMessages((prev) => [...prev, `[錯誤] ${parsed.status}`]);
          }
        } catch {
          // ignore
        }
        handleFinish();
      });
      es.onerror = handleFinish;
    }

    api
      .getExperiment(id)
      .then((data) => {
        if (cancelled) return;
        setExperiment(data);
        if (data.progress) setProgressMessages(data.progress);
        setLoading(false);
        if (data.status === "running" || data.status === "queued") {
          connectSSE();
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "載入失敗");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [id]);

  return { experiment, loading, error, progressMessages };
}

export default function ExperimentPage() {
  const params = useParams();
  const id = params.id as string;
  const progressEndRef = useRef<HTMLDivElement>(null);

  const { experiment, loading, error, progressMessages } = useExperimentData(id);

  // Auto-scroll progress log
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressMessages]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="font-mono text-xs text-muted-foreground">載入中…</p>
        </div>
      </PageShell>
    );
  }

  if (error || !experiment) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <p className="text-sm text-status-err">{error ?? "找不到實驗"}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4 mb-6 border-b border-border pb-4">
        <div className="space-y-2">
          <h1 className="text-base font-semibold text-foreground">{experiment.name}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <StatusBadge status={experiment.status} />
            <span className="font-mono tabular-nums">{experiment.num_configs} 組設定</span>
          </div>
        </div>
      </div>

      {(experiment.status === "running" || experiment.status === "queued") && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-status-warn" />
            <span className="text-status-warn">
              {experiment.status === "queued"
                ? "等待執行中…"
                : "評測執行中，請稍候（每組設定約需數分鐘）"}
            </span>
          </div>
          <div
            className="rounded-md border border-border overflow-hidden"
            style={{ background: "var(--terminal)" }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 h-8">
              <span className="font-mono text-[11px] text-muted-foreground">進度日誌</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
                {progressMessages.length} 行
              </span>
            </div>
            <div className="h-64 overflow-y-auto p-4">
              {progressMessages.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/50 animate-pulse">
                  等待訊息…
                </p>
              ) : (
                progressMessages.map((msg, i) => (
                  <p key={i} className="font-mono text-xs leading-6 text-foreground/80">
                    <span className="select-none mr-3 text-muted-foreground/40 tabular-nums">
                      {String(i + 1).padStart(3, "0")}
                    </span>
                    {msg}
                  </p>
                ))
              )}
              <div ref={progressEndRef} />
            </div>
          </div>
        </div>
      )}

      {experiment.status === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-4 mb-6 space-y-2">
          <p className="text-sm font-medium text-status-err">執行失敗</p>
          {experiment.error && (
            <p className="font-mono text-xs text-status-err/90">{experiment.error}</p>
          )}
          {progressMessages.length > 0 && (
            <div
              className="mt-2 rounded-sm border border-border p-3"
              style={{ background: "var(--terminal)" }}
            >
              {progressMessages.map((msg, i) => (
                <p key={i} className="font-mono text-xs leading-6 text-foreground/70">
                  <span className="select-none mr-3 text-muted-foreground/40 tabular-nums">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {experiment.status === "done" &&
        experiment.results &&
        experiment.results.length > 0 && (
          <ExperimentResults results={experiment.results} />
        )}

      {experiment.status === "done" &&
        (!experiment.results || experiment.results.length === 0) && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            無結果資料
          </div>
        )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 h-12 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回列表
          </Link>
          <span className="h-4 w-px bg-border" />
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            RAGGauge
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
