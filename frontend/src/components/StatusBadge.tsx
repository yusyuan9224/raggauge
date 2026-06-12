import { ExperimentStatus } from "@/lib/types";

const CONFIG: Record<
  ExperimentStatus,
  { label: string; pillClass: string; dotClass: string; pulse?: boolean }
> = {
  queued: {
    label: "排隊中",
    pillClass: "status-pill-neutral",
    dotClass: "bg-muted-foreground/60",
  },
  running: {
    label: "執行中",
    pillClass: "status-pill-warn",
    dotClass: "bg-status-warn",
    pulse: true,
  },
  done: {
    label: "完成",
    pillClass: "status-pill-ok",
    dotClass: "bg-status-ok",
  },
  error: {
    label: "錯誤",
    pillClass: "status-pill-err",
    dotClass: "bg-status-err",
  },
};

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  const cfg = CONFIG[status];
  return (
    <span className={`status-pill ${cfg.pillClass}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass} ${cfg.pulse ? "animate-pulse" : ""}`}
      />
      {cfg.label}
    </span>
  );
}
