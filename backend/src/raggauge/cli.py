"""CLI(v0.1):raggauge run --corpus docs/ --qa qa.json --chunk-size 400 --strategy vector"""

import asyncio
import json
from pathlib import Path

import typer

from .config import settings
from .ollama_client import OllamaClient
from .runner import run_config
from .schemas import QAItem, RunConfig

app = typer.Typer(help="RAGGauge — 自架 RAG 評測", no_args_is_help=True)


@app.callback()
def _root() -> None:
    """強制 typer 走子指令模式(單一指令時會把指令名當參數)。"""


def _fmt(v: float | None) -> str:
    return f"{v:.3f}" if v is not None else "n/a"


@app.command()
def run(
    corpus: Path = typer.Option(..., exists=True, help="文件資料夾(.txt/.md)或單一檔案"),
    qa: Path = typer.Option(..., exists=True, help="QA 測試集 JSON(QAItem 陣列)"),
    chunk_size: int = typer.Option(400),
    chunk_overlap: int = typer.Option(60),
    strategy: str = typer.Option("vector", help="vector / hybrid / hybrid_rerank"),
    top_k: int = typer.Option(4),
    json_out: Path | None = typer.Option(None, "--json"),
) -> None:
    """跑單組設定,輸出指標。"""
    files = sorted(corpus.glob("*.txt")) + sorted(corpus.glob("*.md")) if corpus.is_dir() else [corpus]
    documents = {f.name: f.read_text(encoding="utf-8") for f in files}
    qa_items = [QAItem(**item) for item in json.loads(qa.read_text(encoding="utf-8"))]
    config = RunConfig(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, strategy=strategy, top_k=top_k
    )

    async def go():
        ollama = OllamaClient()
        try:
            return await run_config(
                documents, qa_items, config, ollama,
                qdrant_url=settings.qdrant_url, progress=lambda m: typer.echo(f"  · {m}"),
            )
        finally:
            await ollama.aclose()

    result = asyncio.run(go())
    typer.echo(f"\n══════════ {config.label} ══════════")
    typer.echo(f"  retrieval recall    {_fmt(result.retrieval_recall)}")
    typer.echo(f"  context precision   {_fmt(result.context_precision)}")
    typer.echo(f"  faithfulness        {_fmt(result.faithfulness)}")
    typer.echo(f"  answer correctness  {_fmt(result.answer_correctness)}")
    typer.echo(f"  avg retrieval       {result.avg_retrieval_ms} ms")
    typer.echo(f"  avg generation      {result.avg_generation_ms} ms")
    typer.echo(f"\n  ⚠ judge model:{settings.llm_model}(7B 級 judge 僅供相對比較,絕對值請謹慎解讀)")
    if json_out:
        json_out.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        typer.echo(f"  完整結果(含逐句 judge log)已存 {json_out}")


if __name__ == "__main__":
    app()
