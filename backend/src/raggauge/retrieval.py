"""檢索層:純向量(Qdrant)、BM25(jieba+rank-bm25)、RRF 混合、可選 rerank。

中文不能用 Qdrant 原生 BM25(FastEmbed tokenizer 對中文幾乎無效,
見 qdrant/qdrant#8014),因此 BM25 用 jieba 斷詞在程序內計算,
與向量結果做 Reciprocal Rank Fusion——只用排名融合,迴避分數量綱問題。
"""

import time
import uuid
from dataclasses import dataclass, field

import jieba
from qdrant_client import QdrantClient
from qdrant_client import models as qm
from rank_bm25 import BM25Okapi

from .chunking import Chunk
from .ollama_client import OllamaClient


def tokenize_zh(text: str) -> list[str]:
    return [t for t in jieba.cut_for_search(text) if t.strip()]


@dataclass
class RetrievedChunk:
    chunk_id: int
    text: str
    score: float


@dataclass
class Index:
    """一組設定下的完整索引(向量 + BM25)。"""

    collection: str
    chunks: list[Chunk]
    bm25: BM25Okapi
    client: QdrantClient = field(repr=False)


async def build_index(
    chunks: list[Chunk],
    ollama: OllamaClient,
    qdrant_url: str | None = None,
    collection: str | None = None,
) -> Index:
    client = QdrantClient(url=qdrant_url) if qdrant_url else QdrantClient(location=":memory:")
    name = collection or f"raggauge_{uuid.uuid4().hex[:8]}"
    vectors = await ollama.embed([c.text for c in chunks])
    if client.collection_exists(name):
        client.delete_collection(name)
    client.create_collection(
        collection_name=name,
        vectors_config=qm.VectorParams(size=len(vectors[0]), distance=qm.Distance.COSINE),
    )
    client.upsert(
        collection_name=name,
        points=[
            qm.PointStruct(id=c.id, vector=v, payload={"text": c.text, "chunk_id": c.id})
            for c, v in zip(chunks, vectors, strict=True)
        ],
    )
    bm25 = BM25Okapi([tokenize_zh(c.text) for c in chunks])
    return Index(collection=name, chunks=chunks, bm25=bm25, client=client)


async def retrieve(
    index: Index,
    question: str,
    ollama: OllamaClient,
    strategy: str,
    top_k: int,
) -> tuple[list[RetrievedChunk], float]:
    """回傳 (結果, 檢索毫秒)。rerank 需要額外依賴,未安裝時退回 hybrid。"""
    t0 = time.perf_counter()
    fetch_k = top_k * 3 if strategy != "vector" else top_k

    qvec = (await ollama.embed([question]))[0]
    hits = index.client.query_points(
        collection_name=index.collection, query=qvec, limit=fetch_k
    ).points
    dense = [RetrievedChunk(h.payload["chunk_id"], h.payload["text"], h.score) for h in hits]

    if strategy == "vector":
        return dense[:top_k], (time.perf_counter() - t0) * 1000

    scores = index.bm25.get_scores(tokenize_zh(question))
    sparse_rank = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:fetch_k]
    sparse = [RetrievedChunk(index.chunks[i].id, index.chunks[i].text, float(scores[i])) for i in sparse_rank]

    fused = _rrf([dense, sparse])
    if strategy == "hybrid_rerank":
        fused = await _maybe_rerank(question, fused)
    return fused[:top_k], (time.perf_counter() - t0) * 1000


def _rrf(rankings: list[list[RetrievedChunk]], k: int = 60) -> list[RetrievedChunk]:
    """Reciprocal Rank Fusion:score = Σ 1/(k + rank)。"""
    by_id: dict[int, RetrievedChunk] = {}
    fused_scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, rc in enumerate(ranking):
            fused_scores[rc.chunk_id] = fused_scores.get(rc.chunk_id, 0.0) + 1.0 / (k + rank + 1)
            by_id.setdefault(rc.chunk_id, rc)
    ordered = sorted(fused_scores, key=lambda cid: fused_scores[cid], reverse=True)
    return [RetrievedChunk(cid, by_id[cid].text, fused_scores[cid]) for cid in ordered]


_reranker = None


async def _maybe_rerank(question: str, candidates: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """bge-reranker-v2-m3(FlagEmbedding,optional extra)。未安裝時維持 RRF 排序。"""
    global _reranker
    try:
        if _reranker is None:
            from FlagEmbedding import FlagReranker  # noqa: PLC0415

            _reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=True)
    except ImportError:
        return candidates
    pairs = [[question, c.text] for c in candidates]
    scores = _reranker.compute_score(pairs)
    if not isinstance(scores, list):
        scores = [scores]
    order = sorted(range(len(candidates)), key=lambda i: scores[i], reverse=True)
    return [RetrievedChunk(candidates[i].chunk_id, candidates[i].text, float(scores[i])) for i in order]
