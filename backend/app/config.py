from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@postgres:5432/grocery_ai"
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "grocery_ai"

    model_dir: str = "/app/backend/ml_models"

    model_config = {"env_file": ".env", "extra": "ignore", "protected_namespaces": ("settings_",)}


settings = Settings()
