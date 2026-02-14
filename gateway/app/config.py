"""
Application configuration and settings.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    # Application settings
    title: str = "MediRunner WebSocket Gateway"
    description: str = "WebSocket gateway for MediRunner robot communication"
    version: str = "1.0.0"
    
    # CORS settings as strings
    cors_origins: str = "*"
    cors_methods: str = "*"
    cors_headers: str = "*"
    
    def get_cors_list(self, value: str) -> list[str]:
        """Convert comma-separated string to list."""
        if value == "*":
            return ["*"]
        return [item.strip() for item in value.split(",") if item.strip()]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()