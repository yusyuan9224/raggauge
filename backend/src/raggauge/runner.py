"""實驗執行:對每組 RunConfig 建索引 → 逐題檢索 + 生成 + 評測。"""

import asyncio
import time
from collections.abc import Callable

from .chunking import chunk_document
from .config import settings
from .metrics import answer_correctness, context_precision, faithfulness, retrieval_recall
from .ollama_client import OllamaClient
from .retrieval import build_index, retrieve
from .schemas import ConfigResult, QAItem, QuestionResult, RunConfig, mean_or_none

ANSWER_SYSTEM = """\
你是知識庫問答助理。「只」根據提供的參考文段回答問題:
- 文段中找不到答案時,直接回答「根據提供的資料無法回答這個問題」
- 不要使用文段以外的知識,不要編造
- 用與問題相同的語言簡潔回答"""


async def answer_question(ollama: OllamaClient, question: str, contexts: list[str]) -> tuple[str, float]:
    body = "\n---\n".join(contexts)
    t0 = time.perf_counter()
    answer = await ollama.chat(
        [
            {"role": "system", "content": ANSWER_SYSTEM},
            {"role": "user", "content": f"參考文段:\n{body}\n\n問題:{question}"},
        ]
    )
    return answer.strip(), (time.perf_counter() - t0) * 1000


async def run_config(
    documents: dict[str, str],
    qa_items: list[QAItem],
    config: RunConfig,
    ollama: OllamaClient,
    qdrant_url: str | None = None,
    progress: Callable[[str], None] | None = None,
) -> ConfigResult:
    def report(msg: str) -> None:
        if progress:
            progress(msg)

    chunks = []
    for doc_id, text in documents.items():
        chunks.extend(
            chunk_document(doc_id, text, config.chunk_size, config.chunk_overlap, start_id=len(chunks))
        )
    report(f"[{config.label}] 切塊 {len(chunks)} 個,建索引中")
    index = await build_index(chunks, ollama, qdrant_url=qdrant_url)
    report(f"[{config.label}] 索引完成,開始 {len(qa_items)} 題評測")

    sem = asyncio.Semaphore(settings.judge_concurrency)

    async def eval_question(qi: int, item: QAItem) -> QuestionResult:
        async with sem:
            retrieved, ret_ms = await retrieve(index, item.question, ollama, config.strategy, config.top_k)
            texts = [r.text for r in retrieved]
            answer, gen_ms = await answer_question(ollama, item.question, texts)
            log: list[str] = []
            cp = await context_precision(ollama, item.question, texts, log)
            ff = await faithfulness(ollama, answer, texts, log)
            ac = await answer_correctness(ollama, answer, item.golden_answer, log)
            result = QuestionResult(
                question=item.question,
                answer=answer,
                retrieved=texts,
                retrieval_recall=retrieval_recall(item.golden_evidence, texts),
                context_precision=cp,
                faithfulness=ff,
                answer_correctness=ac,
                retrieval_ms=round(ret_ms, 1),
                generation_ms=round(gen_ms, 1),
                judge_log=log,
            )
            report(f"[{config.label}] 第 {qi + 1}/{len(qa_items)} 題完成")
            return result

    questions = list(await asyncio.gather(*(eval_question(i, item) for i, item in enumerate(qa_items))))
    index.client.delete_collection(index.collection)

    return ConfigResult(
        config=config,
        questions=questions,
        retrieval_recall=mean_or_none([q.retrieval_recall for q in questions]),
        context_precision=mean_or_none([q.context_precision for q in questions]),
        faithfulness=mean_or_none([q.faithfulness for q in questions]),
        answer_correctness=mean_or_none([q.answer_correctness for q in questions]),
        avg_retrieval_ms=round(sum(q.retrieval_ms for q in questions) / max(len(questions), 1), 1),
        avg_generation_ms=round(sum(q.generation_ms for q in questions) / max(len(questions), 1), 1),
    )
