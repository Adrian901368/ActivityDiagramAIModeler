from typing import List

from openai import OpenAI

from app.core.config import settings


def get_llm_client() -> OpenAI:
    """
    makes and creates client pre Groq (OpenAI-compatible API).
    """
    return OpenAI(
        api_key=settings.llm.api_key,
        base_url=settings.llm.base_url,
    )


def generate_simple_response(messages: List[dict]) -> str:
    """
    simple wrapper over LLM call.
    for now just connection testing – later it will be
    specialized funciton for PlantUML.
    """
    client = get_llm_client()

    response = client.chat.completions.create(
        model=settings.llm.model,
        messages=messages,
        temperature=settings.llm.temperature,
    )

    return response.choices[0].message.content
