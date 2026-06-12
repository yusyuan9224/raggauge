"""全域設定:環境變數前綴 RAGGAUGE_。"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAGGAUGE_", env_file=".env", extra="ignore")

    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:7b"  # 答案生成 + judge
    embed_model: str = "bge-m3"

    qdrant_url: str | None = None  # None = in-memory(CLI/測試)
    db_path: str = "raggauge.db"

    llm_timeout: float = 300.0
    llm_retries: int = 3
    judge_concurrency: int = 3
    data_dir: str = "data"  # 上傳的 corpus / QA set 存放處


settings = Settings()
