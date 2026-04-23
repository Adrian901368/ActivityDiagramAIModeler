# app/services/llm_service.py

from typing import List, Dict, Any
import json
import logging

import google.generativeai as genai
from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_STRUCTURED_ACTORS = 20
MAX_STRUCTURED_ACTIONS = 100

def get_llm_client() -> OpenAI:
    """
    Create an OpenAI-compatible client for Groq using configuration from settings.
    """
    return OpenAI(
        api_key=settings.llm.api_key,
        base_url=settings.llm.base_url,
    )


def get_vision_client() -> genai.GenerativeModel:
    """
    Create a Gemini vision client using VISION_API_KEY and VISION_MODEL from settings.
    """
    genai.configure(api_key=settings.vision.api_key)
    return genai.GenerativeModel(settings.vision.model)


def log_groq_rate_limits(response: Any) -> None:
    """
    Log Groq token/day rate limit information if available in response headers.
    """
    headers = getattr(response, "response_headers", None)

    if not headers:
        logger.info("[Groq] Rate limit headers are not available in the response.")
        return

    limit_tpd = headers.get("x-ratelimit-limit-tokens-day", "N/A")
    remaining_tpd = headers.get("x-ratelimit-remaining-tokens-day", "N/A")
    reset_tpd = headers.get("x-ratelimit-reset-tokens-day", "N/A")

    logger.info(
        "[Groq] Daily token limit: %s | Remaining: %s | Reset: %s",
        limit_tpd,
        remaining_tpd,
        reset_tpd,
    )


def sanitize_structured_process_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize LLM JSON output so it better matches the current Pydantic schema.
    """
    if not isinstance(payload, dict):
        return {}

    parallel_blocks = payload.get("parallel_blocks")
    if parallel_blocks is None and "parallel_branches" in payload:
        parallel_blocks = payload.get("parallel_branches")

    actors = payload.get("actors")
    if not isinstance(actors, list):
        actors = []

    cleaned_actors: List[str] = []
    seen_actors: set[str] = set()
    for actor in actors:
        if not isinstance(actor, str):
            continue
        actor_name = actor.strip()
        if not actor_name:
            continue
        if actor_name in seen_actors:
            continue
        seen_actors.add(actor_name)
        cleaned_actors.append(actor_name)

    actions = payload.get("actions")
    if not isinstance(actions, list):
        actions = []

    cleaned_actions: List[Dict[str, str]] = []
    for item in actions:
        if not isinstance(item, dict):
            continue
        actor = item.get("actor")
        action = item.get("action")
        if not isinstance(actor, str) or not isinstance(action, str):
            continue
        actor = actor.strip()
        action = action.strip()
        if not actor or not action:
            continue
        cleaned_actions.append({"actor": actor, "action": action})

    cleaned_decisions: List[Dict[str, Any]] = []
    decisions = payload.get("decisions")
    if isinstance(decisions, list):
        actions_len = len(cleaned_actions)

        for item in decisions:
            if not isinstance(item, dict):
                continue

            condition = item.get("condition")
            branch_yes = item.get("branch_yes") or item.get("branchyes")
            branch_no = item.get("branch_no") or item.get("branchno")

            if not isinstance(condition, str) or not condition.strip():
                continue
            if not isinstance(branch_yes, str) or not branch_yes.strip():
                continue
            if not isinstance(branch_no, str) or not branch_no.strip():
                continue

            yes_action_index = item.get("yes_action_index") or item.get("yesactionindex")
            no_action_index = item.get("no_action_index") or item.get("noactionindex")

            if not isinstance(yes_action_index, int):
                yes_action_index = None
            elif yes_action_index < 0 or yes_action_index >= actions_len:
                yes_action_index = None

            if not isinstance(no_action_index, int):
                no_action_index = None
            elif no_action_index < 0 or no_action_index >= actions_len:
                no_action_index = None

            cleaned_decisions.append(
                {
                    "condition": condition.strip(),
                    "branch_yes": branch_yes.strip(),
                    "branch_no": branch_no.strip(),
                    "yes_action_index": yes_action_index,
                    "no_action_index": no_action_index,
                }
            )

    cleaned_parallel_blocks: List[Dict[str, Any]] = []
    if isinstance(parallel_blocks, list):
        for block in parallel_blocks:
            if not isinstance(block, dict):
                continue

            block_actions = block.get("actions")
            if not isinstance(block_actions, list):
                continue

            cleaned_block_actions: List[Dict[str, str]] = []
            for item in block_actions:
                if not isinstance(item, dict):
                    continue
                actor = item.get("actor")
                action = item.get("action")
                if not isinstance(actor, str) or not isinstance(action, str):
                    continue
                actor = actor.strip()
                action = action.strip()
                if not actor or not action:
                    continue
                cleaned_block_actions.append({"actor": actor, "action": action})

            if len(cleaned_block_actions) >= 2:
                cleaned_parallel_blocks.append({"actions": cleaned_block_actions})

    result: Dict[str, Any] = {
        "actors": cleaned_actors[:MAX_STRUCTURED_ACTORS],
        "actions": cleaned_actions[:MAX_STRUCTURED_ACTIONS],
    }

    if cleaned_decisions:
        result["decisions"] = cleaned_decisions

    if cleaned_parallel_blocks:
        result["parallel_blocks"] = cleaned_parallel_blocks

    process_name = payload.get("process_name")
    if isinstance(process_name, str) and process_name.strip():
        result["process_name"] = process_name.strip()

    return result


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

    log_groq_rate_limits(response)

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
    """
    client = get_llm_client()

    system_message = {
        "role": "system",
        "content": (
            "You are an assistant that converts a natural language description of a "
            "business process into a structured JSON object.\n\n"
            "You must follow these hard limits:\n"
            f"- actors: maximum {MAX_STRUCTURED_ACTORS}\n"
            f"- actions: maximum {MAX_STRUCTURED_ACTIONS}\n\n"
            "The JSON MUST use only the following keys (all in English):\n"
            " * 'process_name': string\n"
            " * 'actors': array of strings\n"
            " * 'actions': array of objects { 'actor': string, 'action': string }\n"
            " * 'decisions': array of objects {\n"
            "     'condition': string,\n"
            "     'branch_yes': string,\n"
            "     'branch_no': string,\n"
            "     'yes_action_index': integer or null,\n"
            "     'no_action_index': integer or null\n"
            "   }\n"
            " * 'parallel_blocks': array of objects {\n"
            "     'actions': array of objects { 'actor': string, 'action': string }\n"
            "   }\n\n"
            "LANGUAGE REQUIREMENTS:\n"
            "- All VALUES (process name, actor names, actions, decision conditions, "
            "branch texts) MUST be written in clear English, even if the input "
            "description is not in English.\n"
            "- Do NOT add any extra keys.\n\n"
            "DECISION EXTRACTION RULES:\n"
            "- Carefully analyze the description for any kind of branching logic, "
            "such as conditions, success vs. failure outcomes, yes/no checks, "
            "approval vs. rejection, or alternative error paths.\n"
            "- Whenever such branching is present, you MUST create at least one "
            "entry in the 'decisions' array.\n"
            "- The 'condition' should summarize the check being performed.\n"
            "- 'branch_yes' and 'branch_no' must clearly describe what happens "
            "in each branch.\n\n"
            "DECISION–ACTION CONSISTENCY AND INDICES:\n"
            "- Each item in 'actions' represents a concrete step in the process.\n"
            "- You MUST make sure that the outcomes described in 'branch_yes' and "
            "'branch_no' correspond to one or more actions.\n"
            "- Set 'yes_action_index' and 'no_action_index' only when you can map "
            "the branch to an existing action with high confidence.\n"
            "- If you are uncertain, use null.\n"
            "- Never invent an index.\n"
            "- Indices MUST always be zero-based.\n"
            "- Indices MUST always be between 0 and len(actions)-1 when they "
            "are not null.\n"
            "- If a branch contains several consecutive actions, choose the index "
            "of the FIRST action in that branch.\n\n"
            "PARALLEL BLOCK RULES:\n"
            "- Use 'parallel_blocks' only for truly parallel actions.\n"
            "- Each parallel block must contain at least 2 actions.\n\n"
            "OUTPUT FORMAT:\n"
            "- Return ONLY a valid JSON object, without comments or any "
            "surrounding text."
        ),
    }

    user_payload: Dict[str, Any] = {
        "description": description,
        "input_language": language,
        "constraints": {
            "max_actors": MAX_STRUCTURED_ACTORS,
            "max_actions": MAX_STRUCTURED_ACTIONS,
            "use_parallel_blocks_key": True,
            "if_index_is_uncertain_use_null": True,
        },
    }

    if process_name:
        user_payload["process_name"] = process_name
    if domain:
        user_payload["domain"] = domain

    user_message = {
        "role": "user",
        "content": (
            "Based on the following description of a business process, create a "
            "JSON object that follows the schema described above.\n\n"
            "Use only these keys: process_name, actors, actions, decisions, "
            "parallel_blocks.\n\n"
            "All labels and texts inside the JSON (process name, actor names, "
            "actions, conditions, branches) MUST be in English.\n\n"
            "If the description contains any success/failure outcome, conditions, "
            "or 'if / otherwise' logic, you MUST represent that logic explicitly "
            "in the 'decisions' array.\n\n"
            "For yes_action_index and no_action_index:\n"
            "- use a valid zero-based index into actions when the mapping is clear,\n"
            "- otherwise use null,\n"
            "- never return guessed or out-of-range indices.\n\n"
            "Input:\n"
            f"{json.dumps(user_payload, ensure_ascii=False, indent=2)}"
        ),
    }

    response = client.chat.completions.create(
        model=settings.llm.model,
        messages=[system_message, user_message],
        temperature=settings.llm.temperature,
        response_format={"type": "json_object"},
    )

    log_groq_rate_limits(response)

    raw_content = response.choices[0].message.content

    if isinstance(raw_content, dict):
        return sanitize_structured_process_payload(raw_content)

    parsed = json.loads(raw_content or "{}")
    return sanitize_structured_process_payload(parsed)


def generate_structured_prompt_from_image(
    image_bytes: bytes,
    image_media_type: str = "image/png",
) -> Dict[str, Any]:
    """
    Extract a ProcessStructureInput-compatible JSON from a PNG/JPEG image
    of an existing UML Activity Diagram using a 2-step pipeline:

    Step 1 — Gemini Vision (free tier):
    Analyze the image and return a detailed textual description of the
    diagram (actors, actions, decisions, flow).

    Step 2 — Groq (generate_structured_prompt_from_text):
    Convert the textual description into a structured JSON matching
    the ProcessStructureInput schema.
    """
    vision_model = get_vision_client()

    vision_prompt = (
        "You are analyzing a UML Activity Diagram in swimlane style.\n\n"
        "Your task is to describe the diagram in plain English with maximum detail:\n"
        "1. List all swimlane names (these are the actors/participants).\n"
        "2. List all action steps in order, specifying which actor performs each step.\n"
        "3. List all decision points (diamond shapes) with their condition text "
        "and what happens in the YES branch and NO branch.\n"
        "4. Describe the overall flow from start to end.\n\n"
        "Be precise and complete. Do not skip any node or branch. "
        "Write the description in clear English."
    )

    try:
        image_part = {"mime_type": image_media_type, "data": image_bytes}
        vision_response = vision_model.generate_content([vision_prompt, image_part])
        text_description = vision_response.text
    except Exception as exc:
        raise RuntimeError(f"Gemini vision call failed: {exc}") from exc

    if not text_description or not text_description.strip():
        raise RuntimeError(
            "Gemini returned an empty description for the image. "
            "Please try a clearer or higher-resolution image."
        )

    logger.info(
        "[Vision] Gemini extracted description (%d chars), passing to Groq.",
        len(text_description),
    )

    return generate_structured_prompt_from_text(description=text_description)


def update_structure_by_prompt(
    current_structure: Dict[str, Any],
    update_instruction: str,
) -> Dict[str, Any]:
    """
    Apply a free-text update instruction to an existing process structure using Groq.
    """
    from app.core.prompts import build_update_diagram_system_prompt

    client = get_llm_client()

    system_prompt = build_update_diagram_system_prompt(current_structure)

    system_message = {
        "role": "system",
        "content": system_prompt,
    }

    user_message = {
        "role": "user",
        "content": (
            f"UPDATE INSTRUCTION:\n{update_instruction.strip()}\n\n"
            "Return the complete updated structure as a single valid JSON object. "
            "Do not include any explanation or surrounding text."
        ),
    }

    response = client.chat.completions.create(
        model=settings.llm.model,
        messages=[system_message, user_message],
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    log_groq_rate_limits(response)

    raw_content = response.choices[0].message.content

    if isinstance(raw_content, dict):
        return sanitize_structured_process_payload(raw_content)

    parsed = json.loads(raw_content or "{}")
    return sanitize_structured_process_payload(parsed)