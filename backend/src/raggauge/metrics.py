"""評測指標:透明、可解釋、binary 判斷優先。

設計原則(評測工具的數字必須可信):
- 7B judge 做連續評分不可靠 → 全部拆成二元判斷(YES/NO),再以比例聚合
- 每次 judge 的問題與判決都記錄到 judge_log,UI 可逐句檢視
- retrieval recall 是規則式(golden evidence 子字串比對),完全不經 LLM
"""

import re

from .ollama_client import OllamaClient, StructuredOutputError
from .schemas import LLMStatements, LLMVerdict

_WS = re.compile(r"\s+")


def _norm(s: str) -> str:
    return _WS.sub("", s)


def retrieval_recall(golden_evidence: list[str], retrieved_texts: list[str]) -> float | None:
    """規則式:每條 golden 證據是否出現在任一檢回 chunk(忽略空白)。"""
    if not golden_evidence:
        return None
    joined = [_norm(t) for t in retrieved_texts]
    hits = sum(1 for ev in golden_evidence if any(_norm(ev) in t for t in joined))
    return hits / len(golden_evidence)


async def _binary_judge(ollama: OllamaClient, system: str, user: str, log: list[str], tag: str) -> bool | None:
    """單次二元判斷;judge 失敗回 None(不計入指標,不假裝有答案)。"""
    try:
        v = await ollama.generate_structured(system, user, LLMVerdict)
    except StructuredOutputError:
        log.append(f"[{tag}] judge 失敗(結構化輸出重試耗盡)")
        return None
    log.append(f"[{tag}] {'✓' if v.verdict else '✗'} {v.reason}")
    return v.verdict


CONTEXT_PRECISION_SYSTEM = """\
你是 RAG 評測員。判斷給定的「文段」對回答「問題」是否有實質幫助。
只看文段是否包含回答所需的資訊,不要腦補。輸出 verdict(true/false)與一句話理由。"""


async def context_precision(
    ollama: OllamaClient, question: str, retrieved_texts: list[str], log: list[str]
) -> float | None:
    """逐 chunk 二元判斷有用與否 → Average Precision(有用的 chunk 排越前面分數越高)。"""
    rels: list[bool] = []
    for i, text in enumerate(retrieved_texts):
        verdict = await _binary_judge(
            ollama,
            CONTEXT_PRECISION_SYSTEM,
            f"問題:{question}\n\n文段:{text[:1500]}",
            log,
            f"context#{i + 1}",
        )
        rels.append(bool(verdict))
    return average_precision(rels) if rels else None


def average_precision(rels: list[bool]) -> float:
    """AP:有用的項目排得越前面分數越高;全部無用 = 0。"""
    total_rel = sum(rels)
    if total_rel == 0:
        return 0.0
    ap = sum(sum(rels[: k + 1]) / (k + 1) for k, rel in enumerate(rels) if rel)
    return ap / total_rel


DECOMPOSE_SYSTEM = """\
你是文本分析員。把給定的「回答」拆解成獨立的原子陳述句:
- 每句只含一個可驗證的事實
- 用原文語言改寫成完整句子(主詞明確)
- 忽略客套話、免責聲明;若回答表示「不知道/查無資料」,輸出空陣列"""

FAITHFULNESS_SYSTEM = """\
你是 RAG 評測員。判斷「陳述」是否能由「參考文段」直接支持(可推導)。
文段沒提到或互相矛盾 → false。輸出 verdict 與一句話理由。"""


async def faithfulness(
    ollama: OllamaClient, answer: str, retrieved_texts: list[str], log: list[str]
) -> float | None:
    """答案拆原子陳述 → 逐句問「context 可支持?」→ 支持比例。"""
    try:
        decomposed = await ollama.generate_structured(
            DECOMPOSE_SYSTEM, f"回答:{answer}", LLMStatements
        )
    except StructuredOutputError:
        log.append("[faithfulness] 陳述拆解失敗")
        return None
    statements = [s for s in decomposed.statements if s.strip()]
    if not statements:
        log.append("[faithfulness] 無可驗證陳述(拒答或空回答),不計分")
        return None
    context = "\n---\n".join(t[:1200] for t in retrieved_texts)
    verdicts: list[bool] = []
    for i, st in enumerate(statements):
        v = await _binary_judge(
            ollama,
            FAITHFULNESS_SYSTEM,
            f"參考文段:\n{context}\n\n陳述:{st}",
            log,
            f"faith#{i + 1}",
        )
        if v is not None:
            verdicts.append(v)
    return sum(verdicts) / len(verdicts) if verdicts else None


CORRECTNESS_SUPPORT_SYSTEM = """\
你是 RAG 評測員。判斷「陳述」的內容是否被「參考答案」涵蓋(語意相符即可,不需逐字)。
輸出 verdict 與一句話理由。"""


async def answer_correctness(
    ollama: OllamaClient, answer: str, golden_answer: str, log: list[str]
) -> float | None:
    """claims 分解雙向比對:precision(答案 claims 被 golden 涵蓋)
    與 recall(golden claims 被答案涵蓋)→ F1。"""

    async def decompose(text: str, tag: str) -> list[str] | None:
        try:
            r = await ollama.generate_structured(DECOMPOSE_SYSTEM, f"回答:{text}", LLMStatements)
            return [s for s in r.statements if s.strip()]
        except StructuredOutputError:
            log.append(f"[correctness] {tag} 拆解失敗")
            return None

    answer_claims = await decompose(answer, "answer")
    golden_claims = await decompose(golden_answer, "golden")
    if answer_claims is None or golden_claims is None or not golden_claims:
        return None
    if not answer_claims:  # 該答而未答
        return 0.0

    async def coverage(claims: list[str], reference: str, tag: str) -> float | None:
        verdicts = []
        for i, c in enumerate(claims):
            v = await _binary_judge(
                ollama,
                CORRECTNESS_SUPPORT_SYSTEM,
                f"參考答案:{reference}\n\n陳述:{c}",
                log,
                f"{tag}#{i + 1}",
            )
            if v is not None:
                verdicts.append(v)
        return sum(verdicts) / len(verdicts) if verdicts else None

    precision = await coverage(answer_claims, golden_answer, "prec")
    recall = await coverage(golden_claims, answer, "recall")
    if precision is None or recall is None:
        return None
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)
