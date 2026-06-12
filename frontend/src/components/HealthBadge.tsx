"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HealthResponse } from "@/lib/types";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";

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
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
        <WifiOff className="h-3.5 w-3.5" />
        <span>後端離線</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground animate-pulse">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span>連線中…</span>
      </div>
    );
  }

  const online = health.status === "ok" && health.ollama;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
          online
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        {online ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: online ? "#10B981" : "#F59E0B" }} />
        <span>{online ? "已連線" : "Ollama 離線"}</span>
        {health.judge_model && (
          <span className="font-mono text-xs opacity-75 ml-1">
            {health.judge_model}
          </span>
        )}
      </div>
      {health.judge_model && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>7B 級 judge 僅供相對比較</span>
        </div>
      )}
    </div>
  );
}
