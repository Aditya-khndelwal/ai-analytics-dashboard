import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    UPLOAD_DIR: str = "uploads"
    DB_PATH: str = "analytics.db"
    MAX_FILE_SIZE_MB: int = 10
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    """Returns a cached instance of the settings."""
    # Ensure upload directory exists
    settings = Settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    return settings
