# app/services/llm_service.py
from typing import List, Dict, Any
import json

from openai import OpenAI

from app.core.config import settings


def get_llm_client() -> OpenAI:
    """
    Create an OpenAI-compatible client for Groq (or another provider)
    using configuration from app.core.config.settings.
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
    - manual LLM connection tests (test_llm.py, debug scripts)
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
    language: str = "en",
) -> Dict[str, Any]:
    """
    Transform a free-text process description into a structured JSON description.

    Input:
        - description: free text description of the process (any language)
        - process_name, domain: optional meta-information
        - language: hint for input language (default "en")

    Output:
        - dict with the following English keys:

          {
            "process_name": str,               # process name, in English
            "actors": [str],                   # actor names, in English
            "actions": [                       # actions, in English
              {"actor": str, "action": str},
              ...
            ],
            "decisions": [                     # decisions, in English
              {"condition": str,
               "branch_yes": str,
               "branch_no": str},
              ...
            ],
            "parallel_branches": [...],        # may be empty list
            "signals": [...]                   # may be empty list
          }

      IMPORTANT:
        - Even if the input description is in Slovak or any other language,
          ALL actor names, action descriptions, decision conditions and
          branch texts MUST be written in clear English.
    """
    client = get_llm_client()

    system_message = {
        "role": "system",
        "content": (
            "You are an assistant that converts a natural language description of a "
            "business process into a structured JSON object.\n\n"
            "The JSON MUST use exactly the following keys (all in English):\n"
            "  * 'process_name': string\n"
            "  * 'actors': array of strings\n"
            "  * 'actions': array of objects { 'actor': string, 'action': string }\n"
            "  * 'decisions': array of objects {\n"
            "        'condition': string,\n"
            "        'branch_yes': string,\n"
            "        'branch_no': string\n"
            "    }\n"
            "  * 'parallel_branches': array (can be empty)\n"
            "  * 'signals': array (can be empty)\n\n"
            "LANGUAGE REQUIREMENTS:\n"
            "- All VALUES (process name, actor names, actions, decision conditions, "
            "branch texts) MUST be written in clear English, even if the input "
            "description is not in English.\n"
            "- Do NOT add any extra keys.\n"
            "- Return ONLY a valid JSON object, without comments or any "
            "surrounding text."
        ),
    }

    user_payload: Dict[str, Any] = {
        "description": description,
        "input_language": language,
    }
    if process_name:
        user_payload["process_name"] = process_name
    if domain:
        user_payload["domain"] = domain

    user_message = {
        "role": "user",
        "content": (
            "Based on the following description of a business process, create a "
            "JSON object that follows the schema described above. Use exactly the "
            "keys: process_name, actors, actions, decisions, parallel_branches, "
            "signals.\n\n"
            "All labels and texts inside the JSON (process name, actor names, "
            "actions, conditions, branches) MUST be in English.\n\n"
            f"Input \n{json.dumps(user_payload, ensure_ascii=False, indent=2)}"
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
