"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Dataset,
  RunConfig,
  Strategy,
  STRATEGY_LABELS,
  configLabel,
} from "@/lib/types";
import { Plus, Upload, FileText, AlertCircle, Loader2, BookOpen } from "lucide-react";

interface Props {
  datasets: Dataset[];
  onCreated: () => void;
}

const CHUNK_SIZES = [200, 400, 600, 800];
const TOP_K_OPTIONS = [2, 4, 8];
const STRATEGIES: Strategy[] = ["vector", "hybrid", "hybrid_rerank"];

type Step = "dataset" | "params" | "name";

export function NewExperimentDialog({ datasets, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("dataset");

  // Dataset step
  const [datasetMode, setDatasetMode] = useState<"existing" | "upload">("existing");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id ?? "");
  const [uploadName, setUploadName] = useState("");
  const [corpusFiles, setCorpusFiles] = useState<File[]>([]);
  const [qaFile, setQaFile] = useState<File | null>(null);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedDatasetId, setUploadedDatasetId] = useState<string | null>(null);

  // Params step
  const [selectedChunks, setSelectedChunks] = useState<number[]>([200, 400, 600]);
  const [selectedStrategies, setSelectedStrategies] = useState<Strategy[]>(["vector"]);
  const [selectedTopKs, setSelectedTopKs] = useState<number[]>([4]);

  // Name step
  const [expName, setExpName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalConfigs =
    selectedChunks.length * selectedStrategies.length * selectedTopKs.length;

  const configs: RunConfig[] = selectedChunks.flatMap((chunk_size) =>
    selectedStrategies.flatMap((strategy) =>
      selectedTopKs.map((top_k) => ({
        chunk_size,
        chunk_overlap: Math.round(chunk_size * 0.2),
        strategy,
        top_k,
      }))
    )
  );

  const toggle = <T,>(arr: T[], val: T, setter: (v: T[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleLoadExamples = useCallback(async () => {
    setLoadingExamples(true);
    setError(null);
    try {
      const examples = await api.examples();
      // Convert documents to File objects
      const files = Object.entries(examples.documents).map(([filename, text]) => {
        const blob = new Blob([text], { type: "text/plain" });
        return new File([blob], filename, { type: "text/plain" });
      });
      // Convert QA to File object
      const qaBlob = new Blob([JSON.stringify(examples.qa, null, 2)], {
        type: "application/json",
      });
      const qaF = new File([qaBlob], "qa.json", { type: "application/json" });
      setCorpusFiles(files);
      setQaFile(qaF);
      setUploadName((n) => n || "內建範例資料集");
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入範例失敗");
    } finally {
      setLoadingExamples(false);
    }
  }, []);

  const handleUploadDataset = async () => {
    if (!uploadName.trim() || corpusFiles.length === 0 || !qaFile) {
      setError("請填寫名稱、上傳語料檔與 QA 檔");
      return;
    }
    setUploadLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", uploadName);
      corpusFiles.forEach((f) => fd.append("corpus", f));
      fd.append("qa", qaFile);
      const result = await api.createDataset(fd);
      setUploadedDatasetId(result.dataset_id);
      setStep("params");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleNextFromDataset = () => {
    setError(null);
    if (datasetMode === "existing") {
      if (!selectedDatasetId) { setError("請選擇資料集"); return; }
      setStep("params");
    } else {
      handleUploadDataset();
    }
  };

  const handleNextFromParams = () => {
    if (totalConfigs === 0) { setError("請至少選擇一個參數"); return; }
    if (totalConfigs > 24) { setError(`笛卡兒積 ${totalConfigs} 組超過上限 24 組，請減少選項`); return; }
    setError(null);
    setStep("name");
  };

  const handleSubmit = async () => {
    if (!expName.trim()) { setError("請輸入實驗名稱"); return; }
    const dsId = datasetMode === "existing" ? selectedDatasetId : uploadedDatasetId;
    if (!dsId) { setError("資料集 ID 遺失"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createExperiment({
        name: expName,
        dataset_id: dsId,
        configs,
      });
      setOpen(false);
      onCreated();
      router.push(`/experiments/${result.experiment_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // reset
      setStep("dataset");
      setError(null);
      setUploadedDatasetId(null);
      setCorpusFiles([]);
      setQaFile(null);
      setUploadName("");
      setExpName("");
    }
  };

  const stepIndex = step === "dataset" ? 0 : step === "params" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            新建實驗
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[560px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">新建實驗</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {["選資料集", "設定參數", "命名送出"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i < stepIndex
                      ? "bg-primary/20 text-primary"
                      : i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs ${
                    i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {i < 2 && <div className="h-px w-6 bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* ── Step 1: Dataset ── */}
          {step === "dataset" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setDatasetMode("existing")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    datasetMode === "existing"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  使用現有資料集
                </button>
                <button
                  onClick={() => setDatasetMode("upload")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    datasetMode === "upload"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  上傳新資料集
                </button>
              </div>

              {datasetMode === "existing" ? (
                datasets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    目前無資料集，請切換「上傳新資料集」
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">選擇資料集</Label>
                    <Select value={selectedDatasetId} onValueChange={(v) => { if (v !== null) setSelectedDatasetId(v); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇資料集" />
                      </SelectTrigger>
                      <SelectContent>
                        {datasets.map((ds) => (
                          <SelectItem key={ds.id} value={ds.id}>
                            <span className="font-medium">{ds.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {ds.num_docs} 文件 / {ds.num_questions} 題
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">資料集名稱</Label>
                    <Input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="例：技術文件 v2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">語料檔（.txt / .md，可多選）</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 text-xs text-muted-foreground"
                        onClick={handleLoadExamples}
                        disabled={loadingExamples}
                      >
                        {loadingExamples ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BookOpen className="h-3 w-3" />
                        )}
                        載入內建範例
                      </Button>
                    </div>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-5 cursor-pointer hover:border-foreground/30 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {corpusFiles.length > 0
                          ? `已選 ${corpusFiles.length} 個檔案`
                          : "點擊或拖曳上傳"}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".txt,.md"
                        className="hidden"
                        onChange={(e) =>
                          setCorpusFiles(Array.from(e.target.files ?? []))
                        }
                      />
                    </label>
                    {corpusFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {corpusFiles.map((f) => (
                          <Badge key={f.name} variant="secondary" className="text-xs gap-1">
                            <FileText className="h-2.5 w-2.5" />
                            {f.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">QA 檔（.json）</Label>
                    <label className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 cursor-pointer hover:border-foreground/30 transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {qaFile ? qaFile.name : "點擊選擇 qa.json"}
                      </span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) =>
                          setQaFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Params ── */}
          {step === "params" && (
            <div className="space-y-5">
              <ParamGroup
                label="Chunk Size"
                options={CHUNK_SIZES}
                selected={selectedChunks}
                onToggle={(v) => toggle(selectedChunks, v, setSelectedChunks)}
                renderLabel={(v) => String(v)}
              />
              <ParamGroup
                label="檢索策略"
                options={STRATEGIES}
                selected={selectedStrategies}
                onToggle={(v) => toggle(selectedStrategies, v, setSelectedStrategies)}
                renderLabel={(v) => STRATEGY_LABELS[v]}
              />
              <ParamGroup
                label="Top-K"
                options={TOP_K_OPTIONS}
                selected={selectedTopKs}
                onToggle={(v) => toggle(selectedTopKs, v, setSelectedTopKs)}
                renderLabel={(v) => String(v)}
              />
              <div
                className={`rounded-md border px-4 py-3 text-sm font-medium ${
                  totalConfigs > 24
                    ? "border-destructive/40 bg-destructive/10 text-status-err"
                    : "border-border bg-muted/50 text-foreground"
                }`}
              >
                {totalConfigs > 24 ? (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    將產生 {totalConfigs} 組設定（超過上限 24 組，請減少選項）
                  </span>
                ) : (
                  <span>
                    將產生{" "}
                    <span className="font-mono font-semibold tabular-nums text-primary">{totalConfigs}</span>{" "}
                    組設定
                  </span>
                )}
              </div>
              {totalConfigs > 0 && totalConfigs <= 24 && (
                <div className="flex flex-wrap gap-1.5">
                  {configs.map((c) => (
                    <Badge
                      key={configLabel(c)}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {configLabel(c)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Name ── */}
          {step === "name" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">實驗名稱</Label>
                <Input
                  autoFocus
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="例：chunk size 比較 v1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                />
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">設定摘要</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">資料集：</span>
                  {datasetMode === "existing"
                    ? datasets.find((d) => d.id === selectedDatasetId)?.name ?? selectedDatasetId
                    : uploadName}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">共 </span>
                  <span className="font-mono font-semibold tabular-nums">{totalConfigs}</span>
                  <span className="text-muted-foreground"> 組設定</span>
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-status-err">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (step === "dataset") handleOpenChange(false);
              else if (step === "params") setStep("dataset");
              else setStep("params");
            }}
          >
            {step === "dataset" ? "取消" : "上一步"}
          </Button>

          {step === "dataset" && (
            <Button onClick={handleNextFromDataset} disabled={uploadLoading}>
              {uploadLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              下一步
            </Button>
          )}
          {step === "params" && (
            <Button onClick={handleNextFromParams} disabled={totalConfigs === 0 || totalConfigs > 24}>
              下一步
            </Button>
          )}
          {step === "name" && (
            <Button onClick={handleSubmit} disabled={submitting || !expName.trim()}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              建立並執行
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParamGroup<T>({
  label,
  options,
  selected,
  onToggle,
  renderLabel,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={renderLabel(opt)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-foreground/30"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(opt)}
                className="hidden"
              />
              {renderLabel(opt)}
            </label>
          );
        })}
      </div>
    </div>
  );
}
