"""
Application configuration loaded from environment variables (.env).

This module uses simple dataclasses and python-dotenv instead of Pydantic
settings to keep things straightforward and explicit.
"""

import os
from dataclasses import dataclass, field
from typing import Optional, List

from dotenv import load_dotenv

# Load variables from .env into os.environ
load_dotenv()


@dataclass
class LLMSettings:
    """Configuration for the LLM provider (Groq / OpenAI-compatible API)."""

    provider: str
    api_key: str
    model: str
    base_url: str
    temperature: float


@dataclass
class AuthSettings:
    """Hardcoded credentials for the academic test accounts."""

    allowed_emails: List[str]
    password: str

    def is_valid(self, email: str, password: str) -> bool:
        return email in self.allowed_emails and password == self.password


@dataclass
class Settings:
    """Global application settings."""

    llm: LLMSettings
    auth: AuthSettings
    database_url: str
    plantuml_server_url: str


def get_settings() -> Settings:
    """
    Build Settings instance from environment variables.

    Expected .env variables:
      LLM_PROVIDER=groq
      GROQ_API_KEY=...
      LLM_MODEL=llama-3.3-70b-versatile
      LLM_BASE_URL=https://api.groq.com/openai/v1
      LLM_TEMPERATURE=0.1
      DATABASE_URL=sqlite:///./app.db        (optional)
      PLANTUML_SERVER_BASE=https://www.plantuml.com/plantuml
    """

    # --- LLM configuration ---
    provider = os.getenv("LLM_PROVIDER", "groq").strip() or "groq"

    api_key: Optional[str] = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Check your .env file and add your Groq API key."
        )

    model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile").strip()
    base_url = os.getenv(
        "LLM_BASE_URL",
        "https://api.groq.com/openai/v1",
    ).strip()

    temperature_str = os.getenv("LLM_TEMPERATURE", "0.1").strip()
    try:
        temperature = float(temperature_str)
    except ValueError as exc:
        raise ValueError(
            f"LLM_TEMPERATURE should be a number, found: {temperature_str!r}"
        ) from exc

    llm_settings = LLMSettings(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=temperature,
    )

    # --- Auth configuration (academic test accounts, STU Bratislava faculties) ---
    auth_settings = AuthSettings(
        allowed_emails=[
            "xfiit@stuba.sk",
            "xfei@stuba.sk",
            "xsvf@stuba.sk",
            "xsjf@stuba.sk",
        ],
        password="pass123",
    )

    # --- Database configuration ---
    database_url = os.getenv("DATABASE_URL", "sqlite:///./app.db").strip()

    # --- PlantUML server configuration ---
    plantuml_server_url = os.getenv(
        "PLANTUML_SERVER_BASE",
        "https://www.plantuml.com/plantuml",
    ).strip()

    return Settings(
        llm=llm_settings,
        auth=auth_settings,
        database_url=database_url,
        plantuml_server_url=plantuml_server_url,
    )


# Module-level singleton for places that import `settings` directly
settings = get_settings()