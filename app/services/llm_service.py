# app/services/llm_service.py
from typing import List, Dict, Any
import json

from openai import OpenAI

from app.core.config import settings


def get_llm_client() -> OpenAI:
    """
    Create an OpenAI-compatible client for Groq (or another provider)
    using configuration from app.core.config.settings.

    Uses:
    - settings.llm.api_key
    - settings.llm.base_url
    """
    return OpenAI(
        api_key=settings.llm.api_key,
        base_url=settings.llm.base_url,
    )


def generate_simple_response(messages: List[Dict[str, str]]) -> str:
    """
    Simple wrapper over an LLM chat completion call.

    Currently used for:
    - /api/v1/generate endpoint (PlantUML generation)
    - test_llm.py connection test
    """
    client = get_llm_client()

    response = client.chat.completions.create(
        model=settings.llm.model,
        messages=messages,
        temperature=settings.llm.temperature,
    )

    content = response.choices[0].message.content
    return content or ""


def generate_structured_prompt_from_text(
    description: str,
    process_name: str | None = None,
    domain: str | None = None,
    language: str = "sk",
) -> Dict[str, Any]:
    """
    Transform free-text process description into a structured JSON description.

    Input:
        - description: free text description of the process
        - process_name, domain: optional meta-information
        - language: language of the description ("sk" / "en" ...)

    Output:
        - dict compatible with a future ProcessPromptModel:
          {
            "nazov_procesu": str,
            "akteri": [str],
            "akcie": [{"aktor": str, "akcia": str}, ...],
            "rozhodnutia": [{"podmienka": str, "vetva_ano": str, "vetva_nie": str}, ...],
            "paralelne_vetvy": [...],
            "signaly": [...]
          }

    NOTE:
        Validation against a concrete Pydantic model will be done outside
        this function (e.g., in endpoints.py) to keep the LLM layer generic.
    """
    client = get_llm_client()

    system_message = {
        "role": "system",
        "content": (
            "Si asistent, ktorý z textového opisu procesu vytvorí štruktúrovaný JSON "
            "podľa nasledujúcej schémy:\n"
            "- nazov_procesu: string\n"
            "- akteri: zoznam stringov\n"
            "- akcie: zoznam objektov {aktor: string, akcia: string}\n"
            "- rozhodnutia: zoznam objektov {podmienka, vetva_ano, vetva_nie}\n"
            "- paralelne_vetvy: zoznam (môže byť prázdny)\n"
            "- signaly: zoznam (môže byť prázdny)\n\n"
            "Vráť IBA platný JSON objekt bez komentárov a ďalšieho textu."
        ),
    }

    user_payload: Dict[str, Any] = {
        "description": description,
        "language": language,
    }
    if process_name:
        user_payload["nazov_procesu"] = process_name
    if domain:
        user_payload["domain"] = domain

    user_message = {
        "role": "user",
        "content": (
            "Na základe nasledujúceho opisu procesu vytvor JSON podľa špecifikácie "
            "vyššie. Kľúče musia byť presne: nazov_procesu, akteri, akcie, rozhodnutia, "
            "paralelne_vetvy, signaly.\n\n"
            f"Vstupné dáta:\n{json.dumps(user_payload, ensure_ascii=False, indent=2)}"
        ),
    }

    response = client.chat.completions.create(
        model=settings.llm.model,
        messages=[system_message, user_message],
        temperature=settings.llm.temperature,
        # Groq supports OpenAI-style response_format
        response_format={"type": "json_object"},
    )

    raw_content = response.choices[0].message.content

    # With response_format="json_object" content may be a dict or a JSON string
    if isinstance(raw_content, dict):
        return raw_content

    return json.loads(raw_content or "{}")
