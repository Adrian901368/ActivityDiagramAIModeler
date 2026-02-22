from typing import Tuple, Optional
import os
import re
import requests

PLANTUML_SERVER_BASE = os.getenv(
    "PLANTUML_SERVER_BASE",
    "https://www.plantuml.com/plantuml",
)


def _encode_hex(code: str) -> str:
    """
    Encode PlantUML source to the hex format expected by the public PlantUML server.
    """
    hex_str = code.encode("utf-8").hex()
    return "~h" + hex_str


def _basic_semantic_checks(code: str) -> Tuple[bool, Optional[str]]:
    """
    Lightweight, regex-based semantic checks on top of plain syntax:

    - ensure at least one action (':' ... ';') exists,
    - ensure that if there is any 'if' keyword, there is also 'endif'.

    These checks are intentionally simple and conservative – they should only
    trigger obvious mistakes in the generated diagram, not stylistic issues.
    """
    # At least one action node
    has_action = bool(re.search(r":[^:]+?;", code))
    if not has_action:
        return False, "No action nodes (': ... ;') found in PlantUML code."

    # Balanced if/endif (approximate check)
    if_count = len(re.findall(r"\bif\b", code))
    endif_count = len(re.findall(r"\bendif\b", code))
    if endif_count > if_count:
        return False, "More 'endif' than 'if' keywords found in PlantUML code."
    # We do not fail when if_count > endif_count here, because sometimes
    # style variations (e.g. if/else without explicit endif) are used.
    # Such cases are better caught by the PlantUML server itself.

    return True, None


def validate_plantuml(code: str) -> Tuple[bool, Optional[str]]:
    """
    Returns (is_valid, error_message).

    - (True, None) -> syntax OK (or we skipped validation due to server error)
    - (False, "reason message") -> we consider this a validation failure

    Validation has two layers:

    1) Local, cheap checks:
       - presence of @startuml/@enduml
       - basic semantic checks on actions and if/endif balance

    2) Remote check via PlantUML server:
       - encode code and ask server to render PNG
       - HTTP 200 => syntax OK
       - HTTP 5xx => treat as server problem, do NOT block generation
       - HTTP 4xx/other => treat as syntax/validation error
    """
    if not code or "@startuml" not in code or "@enduml" not in code:
        return False, "Missing @startuml/@enduml in PlantUML code."

    # 1) Local semantic checks
    ok, msg = _basic_semantic_checks(code)
    if not ok:
        return False, msg

    # 2) Remote syntax check using PlantUML server
    encoded = _encode_hex(code)
    base = PLANTUML_SERVER_BASE.rstrip("/")
    url = f"{base}/png/{encoded}"

    try:
        resp = requests.get(url, timeout=10)
    except Exception as exc:
        # Server not available -> do not block generation, just report info
        return True, f"Skipped syntax validation (PlantUML server error: {exc})"

    if resp.status_code == 200:
        # Server successfully rendered PNG -> syntax is OK
        return True, None

    if 500 <= resp.status_code < 600:
        # Server-side error (e.g. 509) -> syntax is probably OK, server has a problem
        return True, f"Skipped syntax validation (PlantUML server HTTP {resp.status_code})"

    # 4xx or other suspicious codes -> treat as error
    return False, f"PlantUML server HTTP {resp.status_code}"
