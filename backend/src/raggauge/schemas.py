"""資料模型:實驗設定、QA 測試集、指標結果。LLM* 開頭者為 judge 的結構化輸出 schema。"""

from typing import Literal

from pydantic import BaseModel, Field

RetrievalStrategy = Literal["vector", "hybrid", "hybrid_rerank"]

STRATEGY_LABELS: dict[str, str] = {
    "vector": "純向量",
    "hybrid": "混合(BM25+向量 RRF)",
    "hybrid_rerank": "混合+Rerank",
}


class QAItem(BaseModel):
    question: str
    golden_answer: str = Field(description="標準答案,answer correctness 的依據")
    golden_evidence: list[str] = Field(
        default_factory=list,
        description="原文證據片段;retrieval recall 檢查這些片段是否被檢回",
    )


class RunConfig(BaseModel):
    """單一組實驗設定。矩陣掃描 = 多個 RunConfig。"""

    chunk_size: int = 400
    chunk_overlap: int = 60
    strategy: RetrievalStrategy = "vector"
    top_k: int = 4

    @property
    def label(self) -> str:
        return f"chunk{self.chunk_size}/{self.strategy}/k{self.top_k}"


class QuestionResult(BaseModel):
    question: str
    answer: str
    retrieved: list[str]  # 檢回的 chunk 文字(依排名)
    retrieval_recall: float | None = None
    context_precision: float | None = None
    faithfulness: float | None = None
    answer_correctness: float | None = None
    retrieval_ms: float = 0
    generation_ms: float = 0
    judge_log: list[str] = Field(default_factory=list)  # 逐句判斷紀錄,透明可檢視


class ConfigResult(BaseModel):
    config: RunConfig
    questions: list[QuestionResult]
    # 各指標平均(None 表示該指標無有效樣本)
    retrieval_recall: float | None = None
    context_precision: float | None = None
    faithfulness: float | None = None
    answer_correctness: float | None = None
    avg_retrieval_ms: float = 0
    avg_generation_ms: float = 0


# ---- judge 結構化輸出(欄位全必填,防 7B 偷懶輸出 {}) ----


class LLMStatements(BaseModel):
    statements: list[str] = Field(description="拆解出的原子陳述句,每句獨立可驗證")


class LLMVerdict(BaseModel):
    verdict: bool
    reason: str = Field(description="一句話理由")


def mean_or_none(values: list[float | None]) -> float | None:
    valid = [v for v in values if v is not None]
    return sum(valid) / len(valid) if valid else None
