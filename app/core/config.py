import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class LLMSettings:
    provider: str
    api_key: str
    model: str
    base_url: str
    temperature: float


@dataclass
class Settings:
    llm: LLMSettings


def get_settings() -> Settings:
    provider = os.getenv("LLM_PROVIDER", "groq")

    api_key: Optional[str] = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Check .env add Groq API key."
        )

    model = os.getenv("LLM_MODEL", "llama-3.3-70b-8192")
    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")

    temperature_str = os.getenv("LLM_TEMPERATURE", "0.1")
    try:
        temperature = float(temperature_str)
    except ValueError:
        raise ValueError(
            f"LLM_TEMPERATURE soudl be a number, found: {temperature_str!r}"
        )

    llm_settings = LLMSettings(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=temperature,
    )

    return Settings(llm=llm_settings)


settings = get_settings()
