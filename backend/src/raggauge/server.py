"""FastAPI 服務:資料集上傳、實驗(設定矩陣)執行、SSE 進度、結果查詢。"""

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings
from .ollama_client import OllamaClient
from .runner import run_config
from .schemas import QAItem, RunConfig
from .store import Store

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

store = Store(settings.db_path)
# 進行中實驗的事件流(記憶體;重啟後歷史結果仍在 SQLite)
live: dict[str, dict] = {}  # exp_id -> {"progress": [...], "event": asyncio.Event, "status": str}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await store.init()
    yield


app = FastAPI(title="RAGGauge API", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    ollama = OllamaClient(timeout=5)
    try:
        resp = await ollama._client.get("/api/tags")
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        return {"status": "ok", "ollama": True, "models": models, "judge_model": settings.llm_model}
    except Exception:  # noqa: BLE001
        return {"status": "degraded", "ollama": False, "models": [], "judge_model": settings.llm_model}
    finally:
        await ollama.aclose()


# ---- datasets ----


@app.post("/api/datasets")
async def create_dataset(
    name: str = Form(...),
    corpus: list[UploadFile] = File(...),
    qa: UploadFile = File(...),
) -> dict:
    documents: dict[str, str] = {}
    for f in corpus:
        if not (f.filename or "").endswith((".txt", ".md")):
            raise HTTPException(415, f"corpus 僅支援 .txt/.md:{f.filename}")
        data = await f.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"{f.filename} 超過 10MB")
        documents[f.filename or f"doc{len(documents)}"] = data.decode("utf-8")
    try:
        qa_items = json.loads((await qa.read()).decode("utf-8"))
        validated = [QAItem(**item).model_dump() for item in qa_items]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"QA 測試集格式錯誤:{exc}") from None
    if not documents or not validated:
        raise HTTPException(422, "corpus 與 QA 測試集都不可為空")
    ds_id = await store.create_dataset(name, documents, validated)
    return {"dataset_id": ds_id, "num_docs": len(documents), "num_questions": len(validated)}


@app.get("/api/datasets")
async def list_datasets() -> list[dict]:
    return await store.list_datasets()


# ---- experiments ----


class ExperimentIn(BaseModel):
    name: str
    dataset_id: str
    configs: list[RunConfig]


@app.post("/api/experiments")
async def create_experiment(payload: ExperimentIn) -> dict:
    if not payload.configs:
        raise HTTPException(422, "至少需要一組設定")
    if len(payload.configs) > 24:
        raise HTTPException(422, "單次實驗最多 24 組設定")
    ds = await store.get_dataset(payload.dataset_id)
    if ds is None:
        raise HTTPException(404, "找不到資料集")
    exp_id = await store.create_experiment(
        payload.name, payload.dataset_id, [c.model_dump() for c in payload.configs]
    )
    live[exp_id] = {"progress": [], "event": asyncio.Event(), "status": "running"}
    asyncio.get_running_loop().create_task(_run_experiment(exp_id, ds, payload.configs))
    return {"experiment_id": exp_id}


async def _run_experiment(exp_id: str, ds: tuple, configs: list[RunConfig]) -> None:
    documents, qa_raw = ds
    qa_items = [QAItem(**item) for item in qa_raw]
    state = live[exp_id]

    def push(msg: str) -> None:
        state["progress"].append(msg)
        state["event"].set()

    await store.set_status(exp_id, "running")
    ollama = OllamaClient()
    try:
        results = []
        for i, config in enumerate(configs):
            push(f"開始第 {i + 1}/{len(configs)} 組:{config.label}")
            result = await run_config(
                documents, qa_items, config, ollama,
                qdrant_url=settings.qdrant_url, progress=push,
            )
            results.append(result.model_dump())
            push(f"完成 {config.label}")
        await store.save_results(exp_id, results)
        state["status"] = "done"
        push("實驗完成")
    except Exception as exc:  # noqa: BLE001
        await store.set_status(exp_id, "error", str(exc))
        state["status"] = "error"
        push(f"實驗失敗:{exc}")
    finally:
        await ollama.aclose()
        state["event"].set()


@app.get("/api/experiments")
async def list_experiments() -> list[dict]:
    return await store.list_experiments()


@app.get("/api/experiments/{exp_id}")
async def get_experiment(exp_id: str) -> dict:
    exp = await store.get_experiment(exp_id)
    if exp is None:
        raise HTTPException(404, "找不到實驗")
    if exp_id in live:
        exp["progress"] = live[exp_id]["progress"]
    return exp


@app.get("/api/experiments/{exp_id}/events")
async def experiment_events(exp_id: str) -> StreamingResponse:
    exp = await store.get_experiment(exp_id)
    if exp is None:
        raise HTTPException(404, "找不到實驗")
    state = live.get(exp_id)

    async def stream():
        if state is None:  # 歷史實驗:直接送終態
            payload = {"status": exp["status"]}
            yield f"event: {exp['status']}\ndata: {json.dumps(payload)}\n\n"
            return
        sent = 0
        while True:
            while sent < len(state["progress"]):
                data = json.dumps({"message": state["progress"][sent]}, ensure_ascii=False)
                yield f"event: progress\ndata: {data}\n\n"
                sent += 1
            if state["status"] in ("done", "error"):
                yield f"event: {state['status']}\ndata: {json.dumps({'status': state['status']})}\n\n"
                return
            state["event"].clear()
            try:
                await asyncio.wait_for(state["event"].wait(), timeout=15)
            except TimeoutError:
                yield ": keepalive\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/examples")
async def example_dataset() -> dict:
    """內建範例資料集(智慧門鎖 FAQ),讓使用者一鍵試用。"""
    base = Path(__file__).resolve().parents[3] / "examples"
    if not base.exists():
        raise HTTPException(404, "examples 不存在")
    documents = {p.name: p.read_text(encoding="utf-8") for p in sorted((base / "corpus").glob("*.txt"))}
    qa = json.loads((base / "qa.json").read_text(encoding="utf-8"))
    return {"documents": documents, "qa": qa}
