import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    DB_PATH: str = os.path.join(BASE_DIR, "analytics.db")
    MAX_FILE_SIZE_MB: int = 10
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    """Returns a cached instance of the settings."""
    # Ensure upload directory exists
    settings = Settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    return settings
