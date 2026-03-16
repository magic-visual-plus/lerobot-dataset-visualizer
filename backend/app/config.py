from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # Root directory containing local datasets in {org}/{dataset}/ layout
    DATA_ROOT: Path = Path("./data")

    # COS (Cloud Object Storage) base URL for video files
    COS_BASE_URL: str = ""

    # HuggingFace fallback
    ENABLE_HF_FALLBACK: bool = True
    HF_BASE_URL: str = "https://huggingface.co/datasets"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8090

    # CORS origins allowed
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
