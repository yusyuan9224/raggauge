import {
  HealthResponse,
  Dataset,
  Experiment,
  ExperimentDetail,
  ExamplesResponse,
  RunConfig,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health(): Promise<HealthResponse> {
    return apiFetch("/api/health");
  },

  examples(): Promise<ExamplesResponse> {
    return apiFetch("/api/examples");
  },

  listDatasets(): Promise<Dataset[]> {
    return apiFetch("/api/datasets");
  },

  createDataset(payload: FormData): Promise<{ dataset_id: string; num_docs: number; num_questions: number }> {
    return apiFetch("/api/datasets", { method: "POST", body: payload });
  },

  listExperiments(): Promise<Experiment[]> {
    return apiFetch("/api/experiments");
  },

  createExperiment(payload: {
    name: string;
    dataset_id: string;
    configs: RunConfig[];
  }): Promise<{ experiment_id: string }> {
    return apiFetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  getExperiment(id: string): Promise<ExperimentDetail> {
    return apiFetch(`/api/experiments/${id}`);
  },

  /** Returns the SSE URL — caller creates EventSource */
  experimentEventsUrl(id: string): string {
    return `${API_URL}/api/experiments/${id}/events`;
  },
};
