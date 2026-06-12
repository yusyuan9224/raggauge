# RAGGauge 📊

> **自架、上傳即用的 RAG 評測 Dashboard** — 上傳文件集與測試問答,一鍵掃描 chunk size × embedding × 檢索策略矩陣,用數據說話。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

人人都會「串一個 RAG」,但沒人說得清自己的 RAG 好不好、為什麼這樣設計。現有評測工具(RAGAS、TruLens)都是 Python 函式庫 — 要寫程式、看不到圖。RAGGauge 是一個 **self-hosted Web Dashboard**:上傳資料 → 跑參數矩陣 → 互動圖表比較 → 匯出最佳設定。100% 本地,零 API 費用。

## Roadmap

- [ ] v0.1 腳本版:給一組設定,輸出評測指標
- [ ] v0.3 Web UI:上傳資料、跑單組評測、看指標表
- [ ] v0.6 參數掃描矩陣 + 圖表對比 + 結果儲存
- [ ] v0.8 混合檢索 / rerank 比較;匯出設定檔
- [ ] v1.0 完整文件、範例資料集、Docker、CI、release

## 技術棧

Next.js + Recharts(前端)・FastAPI(後端)・Ollama + bge-m3(本地模型)・Qdrant(向量)・SQLite(實驗結果)・Docker

## License

[MIT](LICENSE)
