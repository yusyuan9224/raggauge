"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HealthResponse } from "@/lib/types";

export function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <span className="status-pill status-pill-err">
        <span className="h-1.5 w-1.5 rounded-full bg-status-err" />
        後端離線
      </span>
    );
  }

  if (!health) {
    return (
      <span className="status-pill status-pill-neutral animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        連線中…
      </span>
    );
  }

  const online = health.status === "ok" && health.ollama;

  return (
    <div className="flex items-center gap-3">
      {health.judge_model && (
        <span className="hidden sm:inline text-[11px] text-muted-foreground">
          7B 級 judge 僅供相對比較
        </span>
      )}
      <span className={`status-pill ${online ? "status-pill-ok" : "status-pill-warn"}`}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${online ? "bg-status-ok" : "bg-status-warn"}`}
        />
        {online ? "已連線" : "Ollama 離線"}
        {health.judge_model && (
          <span className="font-mono opacity-75">{health.judge_model}</span>
        )}
      </span>
    </div>
  );
}
