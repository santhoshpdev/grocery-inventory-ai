from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@postgres:5432/grocery_ai"
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "grocery_ai"

    model_dir: str = "/app/backend/ml_models"

    jwt_secret: str = "stockintel-ai-super-secret-key-change-in-production"
    default_admin_username: str = "admin"
    default_admin_password: str = "admin123"
    default_admin_role: str = "SYSTEM_ADMIN"

    model_config = {"env_file": ".env", "extra": "ignore", "protected_namespaces": ("settings_",)}


settings = Settings()
