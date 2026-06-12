import { ExperimentStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";

const CONFIG: Record<
  ExperimentStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  queued: {
    label: "排隊中",
    icon: Clock,
    className:
      "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50",
  },
  running: {
    label: "執行中",
    icon: Loader2,
    className:
      "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  },
  done: {
    label: "完成",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
  error: {
    label: "錯誤",
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
  },
};

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 text-xs font-medium ${cfg.className}`}>
      <Icon
        className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`}
      />
      {cfg.label}
    </Badge>
  );
}
