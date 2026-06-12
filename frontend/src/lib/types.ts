export interface QAItem {
  question: string;
  golden_answer: string;
  golden_evidence: string[];
}

export type Strategy = "vector" | "hybrid" | "hybrid_rerank";

export interface RunConfig {
  chunk_size: number;
  chunk_overlap: number;
  strategy: Strategy;
  top_k: number;
}

export interface QuestionResult {
  question: string;
  answer: string;
  retrieved: string[];
  retrieval_recall: number | null;
  context_precision: number | null;
  faithfulness: number | null;
  answer_correctness: number | null;
  retrieval_ms: number;
  generation_ms: number;
  judge_log: string[];
}

export interface ConfigResult {
  config: RunConfig;
  questions: QuestionResult[];
  retrieval_recall: number | null;
  context_precision: number | null;
  faithfulness: number | null;
  answer_correctness: number | null;
  avg_retrieval_ms: number;
  avg_generation_ms: number;
}

export interface HealthResponse {
  status: string;
  ollama: boolean;
  models: string[];
  judge_model: string;
}

export interface Dataset {
  id: string;
  name: string;
  created_at: string;
  num_docs: number;
  num_questions: number;
}

export type ExperimentStatus = "queued" | "running" | "done" | "error";

export interface Experiment {
  id: string;
  name: string;
  dataset_id: string;
  status: ExperimentStatus;
  created_at: string;
  num_configs: number;
  error?: string;
}

export interface ExperimentDetail extends Experiment {
  configs: RunConfig[];
  results: ConfigResult[] | null;
  progress?: string[];
}

export interface ExamplesResponse {
  documents: Record<string, string>;
  qa: QAItem[];
}

export function configLabel(c: RunConfig): string {
  return `chunk${c.chunk_size}/${c.strategy}/k${c.top_k}`;
}

export const STRATEGY_LABELS: Record<Strategy, string> = {
  vector: "純向量",
  hybrid: "混合 BM25+向量 RRF",
  hybrid_rerank: "混合+Rerank",
};

export const METRIC_COLORS = {
  retrieval_recall: "oklch(0.75 0.12 210)",
  context_precision: "oklch(0.7 0.13 255)",
  faithfulness: "oklch(0.75 0.15 150)",
  answer_correctness: "oklch(0.78 0.14 80)",
} as const;

export const METRIC_LABELS = {
  retrieval_recall: "檢索召回率",
  context_precision: "上下文精確度",
  faithfulness: "忠實度",
  answer_correctness: "答案正確性",
} as const;
