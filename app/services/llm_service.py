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

      "process_name": str,   # process name, in English
      "actors": [str],       # actor names, in English
      "actions": [           # actions, in English
        {"actor": str, "action": str},
        ...
      ],
      "decisions": [         # explicit decision points, in English
        {
          "condition": str,
          "branch_yes": str,
          "branch_no": str,
          "yes_action_index": int | null,
          "no_action_index": int | null
        },
        ...
      ],
      "parallel_branches": [...],  # may be empty list
      "signals": [...]             # may be empty list

    IMPORTANT:
    - Even if the input description is in Slovak or any other language,
      ALL actor names, action descriptions, decision conditions and
      branch texts MUST be written in clear English.
    - For any real branching logic in the process, you MUST create at least
      one entry in "decisions".
    """
    client = get_llm_client()

    system_message = {
        "role": "system",
        "content": (
            "You are an assistant that converts a natural language description of a "
            "business process into a structured JSON object.\n\n"
            "The JSON MUST use exactly the following keys (all in English):\n"
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
            " * 'parallel_branches': array (can be empty)\n"
            " * 'signals': array (can be empty)\n\n"
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
            "- The 'condition' should summarize the check being performed "
            "(for example: 'Is the student enrolled and is there free capacity?').\n"
            "- 'branch_yes' and 'branch_no' must clearly describe what happens "
            "in each branch (for example: 'Register the student and show "
            "confirmation' vs. 'Reject the registration and show an error message').\n\n"
            "DECISION–ACTION CONSISTENCY AND INDICES:\n"
            "- Each item in 'actions' represents a concrete step in the process. "
            "You MUST make sure that the outcomes described in 'branch_yes' and "
            "'branch_no' correspond to one or more of these actions.\n"
            "- For every decision, set 'yes_action_index' and 'no_action_index' "
            "to zero-based indices into the 'actions' array, whenever possible.\n"
            "- If a branch directly continues with a specific existing action, "
            "use the index of that action. For example, if the YES branch leads "
            "to the action 'Register the student for the exam', and that action "
            "is at index 6 in the 'actions' array, then 'yes_action_index' must "
            "be 6.\n"
            "- If a branch contains several consecutive actions, choose the index "
            "of the FIRST action in that branch.\n"
            "- If, in a rare case, you cannot map a branch to a specific action, "
            "you may set the corresponding index to null, but you should avoid "
            "this when the mapping is clear from the description.\n"
            "- Indices MUST always be between 0 and len(actions)-1 when they "
            "are not null.\n\n"
            "OUTPUT FORMAT:\n"
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
            "If the description contains any success/failure outcome, conditions, "
            "or 'if / otherwise' logic, you MUST represent that logic explicitly "
            "in the 'decisions' array and, whenever possible, set "
            "'yes_action_index' and 'no_action_index' to indices of existing "
            "actions that correspond to the YES/NO branches.\n\n"
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

    # With response_format=\"json_object\" content may be a dict or a JSON string
    if isinstance(raw_content, dict):
        return raw_content

    return json.loads(raw_content or "{}")
