"""SQLite 實驗儲存:datasets / experiments,結果以 JSON 保存(自架單機定位)。"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite

SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    documents_json TEXT NOT NULL,   -- {filename: text}
    qa_json TEXT NOT NULL           -- QAItem 陣列
);
CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dataset_id TEXT NOT NULL REFERENCES datasets(id),
    status TEXT NOT NULL DEFAULT 'queued',  -- queued/running/done/error
    created_at TEXT NOT NULL,
    configs_json TEXT NOT NULL,
    results_json TEXT,
    error TEXT
);
"""


def _now() -> str:
    return datetime.now(UTC).isoformat()


class Store:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def init(self) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(SCHEMA)
            await db.commit()

    # ---- datasets ----

    async def create_dataset(self, name: str, documents: dict[str, str], qa: list[dict]) -> str:
        ds_id = uuid.uuid4().hex[:12]
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO datasets VALUES (?,?,?,?,?)",
                (ds_id, name, _now(), json.dumps(documents, ensure_ascii=False),
                 json.dumps(qa, ensure_ascii=False)),
            )
            await db.commit()
        return ds_id

    async def list_datasets(self) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall("SELECT * FROM datasets ORDER BY created_at DESC")
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "created_at": r["created_at"],
                "num_docs": len(json.loads(r["documents_json"])),
                "num_questions": len(json.loads(r["qa_json"])),
            }
            for r in rows
        ]

    async def get_dataset(self, ds_id: str) -> tuple[dict[str, str], list[dict]] | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall("SELECT * FROM datasets WHERE id=?", (ds_id,))
        if not rows:
            return None
        r = rows[0]
        return json.loads(r["documents_json"]), json.loads(r["qa_json"])

    # ---- experiments ----

    async def create_experiment(self, name: str, dataset_id: str, configs: list[dict]) -> str:
        exp_id = uuid.uuid4().hex[:12]
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO experiments (id,name,dataset_id,status,created_at,configs_json)"
                " VALUES (?,?,?,?,?,?)",
                (exp_id, name, dataset_id, "queued", _now(), json.dumps(configs, ensure_ascii=False)),
            )
            await db.commit()
        return exp_id

    async def set_status(self, exp_id: str, status: str, error: str | None = None) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE experiments SET status=?, error=? WHERE id=?", (status, error, exp_id)
            )
            await db.commit()

    async def save_results(self, exp_id: str, results: list[dict]) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE experiments SET results_json=?, status='done' WHERE id=?",
                (json.dumps(results, ensure_ascii=False), exp_id),
            )
            await db.commit()

    async def list_experiments(self) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                "SELECT id,name,dataset_id,status,created_at,configs_json,error"
                " FROM experiments ORDER BY created_at DESC"
            )
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "dataset_id": r["dataset_id"],
                "status": r["status"],
                "created_at": r["created_at"],
                "num_configs": len(json.loads(r["configs_json"])),
                "error": r["error"],
            }
            for r in rows
        ]

    async def get_experiment(self, exp_id: str) -> dict | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall("SELECT * FROM experiments WHERE id=?", (exp_id,))
        if not rows:
            return None
        r = rows[0]
        return {
            "id": r["id"],
            "name": r["name"],
            "dataset_id": r["dataset_id"],
            "status": r["status"],
            "created_at": r["created_at"],
            "configs": json.loads(r["configs_json"]),
            "results": json.loads(r["results_json"]) if r["results_json"] else None,
            "error": r["error"],
        }
