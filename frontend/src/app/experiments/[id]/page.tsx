"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ExperimentDetail } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ExperimentResults } from "@/components/ExperimentResults";
import { ArrowLeft, FlaskConical, Loader2, AlertCircle, TerminalSquare } from "lucide-react";

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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">載入中…</p>
        </div>
      </PageShell>
    );
  }

  if (error || !experiment) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-sm text-red-600">{error ?? "找不到實驗"}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">{experiment.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={experiment.status} />
            <span>{experiment.num_configs} 組設定</span>
          </div>
        </div>
      </div>

      {(experiment.status === "running" || experiment.status === "queued") && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            <span className="text-sky-700">
              {experiment.status === "queued"
                ? "等待執行中…"
                : "評測執行中，請稍候（每組設定約需數分鐘）"}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
              <TerminalSquare className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">進度日誌</span>
            </div>
            <div className="h-64 overflow-y-auto p-4 space-y-1">
              {progressMessages.length === 0 ? (
                <p className="text-xs text-slate-600 font-mono animate-pulse">
                  等待訊息…
                </p>
              ) : (
                progressMessages.map((msg, i) => (
                  <p key={i} className="text-xs text-slate-300 font-mono leading-relaxed">
                    <span className="text-slate-600 select-none mr-2">
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
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 mb-6">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-800">執行失敗</p>
            {experiment.error && (
              <p className="text-xs text-red-700 font-mono">{experiment.error}</p>
            )}
            {progressMessages.length > 0 && (
              <div className="mt-3 rounded bg-red-100 p-3 space-y-0.5">
                {progressMessages.map((msg, i) => (
                  <p key={i} className="text-xs text-red-800 font-mono">{msg}</p>
                ))}
              </div>
            )}
          </div>
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
          <span className="text-border">·</span>
          <div className="flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">RAGGauge</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
