import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

# Načíta .env z koreňového priečinka projektu
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
    """
    Centrálne miesto, odkiaľ bude zvyšok aplikácie čítať konfiguráciu.
    Neskôr sem vieme doplniť DB, PlantUML a ďalšie nastavenia.
    """
    # ---- LLM / Groq konfigurácia ----
    provider = os.getenv("LLM_PROVIDER", "groq")

    api_key: Optional[str] = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY nie je nastavený. "
            "Skontroluj súbor .env a doplň svoj Groq API kľúč."
        )

    model = os.getenv("LLM_MODEL", "llama-3.3-70b-8192")
    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")

    # .env je string, treba pretypovať na float
    temperature_str = os.getenv("LLM_TEMPERATURE", "0.1")
    try:
        temperature = float(temperature_str)
    except ValueError:
        raise ValueError(
            f"LLM_TEMPERATURE musí byť číslo, našiel som: {temperature_str!r}"
        )

    llm_settings = LLMSettings(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=temperature,
    )

    return Settings(llm=llm_settings)


# Jediná globálna inštancia nastavení, ktorú budú používať ostatné moduly
settings = get_settings()
