import asyncio
import json

import pytest
from fastapi.testclient import TestClient

import raggauge.server as server_mod
from raggauge.schemas import ConfigResult, QuestionResult
from raggauge.store import Store

QA = [{"question": "Q1", "golden_answer": "A1", "golden_evidence": ["ev"]}]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server_mod, "store", Store(str(tmp_path / "test.db")))

    async def fake_run_config(documents, qa_items, config, ollama, qdrant_url=None, progress=None):
        if progress:
            progress("評測中")
        await asyncio.sleep(0)
        return ConfigResult(
            config=config,
            questions=[
                QuestionResult(question="Q1", answer="A", retrieved=["ev text"], retrieval_recall=1.0)
            ],
            retrieval_recall=1.0,
        )

    monkeypatch.setattr(server_mod, "run_config", fake_run_config)

    class FakeOllama:
        async def aclose(self):
            pass

    monkeypatch.setattr(server_mod, "OllamaClient", lambda *a, **k: FakeOllama())
    server_mod.live.clear()
    with TestClient(server_mod.app) as c:
        yield c


def _upload_dataset(client) -> str:
    resp = client.post(
        "/api/datasets",
        data={"name": "demo"},
        files=[
            ("corpus", ("doc1.txt", b"some ev text", "text/plain")),
            ("qa", ("qa.json", json.dumps(QA).encode(), "application/json")),
        ],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["dataset_id"]


def test_dataset_upload_and_list(client):
    ds_id = _upload_dataset(client)
    listed = client.get("/api/datasets").json()
    assert listed[0]["id"] == ds_id
    assert listed[0]["num_questions"] == 1


def test_dataset_rejects_bad_qa(client):
    resp = client.post(
        "/api/datasets",
        data={"name": "bad"},
        files=[
            ("corpus", ("doc1.txt", b"x", "text/plain")),
            ("qa", ("qa.json", b"not json", "application/json")),
        ],
    )
    assert resp.status_code == 422


def test_experiment_full_flow(client):
    ds_id = _upload_dataset(client)
    resp = client.post(
        "/api/experiments",
        json={"name": "exp1", "dataset_id": ds_id, "configs": [{"chunk_size": 300}]},
    )
    assert resp.status_code == 200, resp.text
    exp_id = resp.json()["experiment_id"]

    for _ in range(100):
        exp = client.get(f"/api/experiments/{exp_id}").json()
        if exp["status"] == "done":
            break
    assert exp["status"] == "done"
    assert exp["results"][0]["retrieval_recall"] == 1.0


def test_experiment_unknown_dataset_404(client):
    resp = client.post(
        "/api/experiments", json={"name": "x", "dataset_id": "nope", "configs": [{}]}
    )
    assert resp.status_code == 404


def test_experiment_empty_configs_422(client):
    ds_id = _upload_dataset(client)
    resp = client.post(
        "/api/experiments", json={"name": "x", "dataset_id": ds_id, "configs": []}
    )
    assert resp.status_code == 422
