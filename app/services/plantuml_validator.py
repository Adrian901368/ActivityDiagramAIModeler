# app/services/plantuml_validator.py
from typing import Tuple, Optional
import os
import re
import hashlib
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
    # Such cases are better caught by the PlantUML server itself during render.

    return True, None


def validate_plantuml(code: str) -> Tuple[bool, Optional[str]]:
    """
    Returns (is_valid, error_message).

    - (True, None)            -> local checks passed
    - (False, "reason msg")   -> local check failed

    Validation is intentionally local-only (no remote HTTP call).
    Reasons:
    - The remote PlantUML server is also called during render (save step),
      so a second HTTP round-trip here would be redundant and slow.
    - The public plantuml.com server enforces rate limits (HTTP 509)
      which would block generation even for valid diagrams.

    Local checks performed:
    1) Presence of @startuml / @enduml markers.
    2) At least one action node (': ... ;').
    3) Approximate if/endif balance.
    """
    if not code or "@startuml" not in code or "@enduml" not in code:
        return False, "Missing @startuml/@enduml in PlantUML code."

    ok, msg = _basic_semantic_checks(code)
    if not ok:
        return False, msg

    return True, None


def render_plantuml_to_png(code: str, output_dir: str = "generated_diagrams") -> Optional[str]:
    """
    Render valid PlantUML code to PNG using PlantUML server and save it to disk.

    SHA1-based file cache: if a PNG for this exact PlantUML source already
    exists on disk, it is returned immediately without any HTTP request.
    This eliminates redundant server calls when the same diagram is saved
    multiple times (e.g. after re-opening from catalog).

    Returns:
    - Filesystem path to the saved (or cached) PNG file on success.
    - None if the PlantUML server is temporarily unavailable (5xx / network
      error), so that callers can proceed without a PNG rather than failing.

    Raises:
    - ValueError: if @startuml/@enduml are missing in the input code.
    - RuntimeError: if local file I/O fails after a successful server response.
    """
    if not code or "@startuml" not in code or "@enduml" not in code:
        raise ValueError("Missing @startuml/@enduml in PlantUML code.")

    digest = hashlib.sha1(code.encode("utf-8")).hexdigest()[:16]
    filename = f"diagram_{digest}.png"
    filepath = os.path.join(output_dir, filename)

    # Return cached PNG immediately — no HTTP call needed
    if os.path.exists(filepath):
        return filepath

    encoded = _encode_hex(code)
    base = PLANTUML_SERVER_BASE.rstrip("/")
    url = f"{base}/png/{encoded}"

    try:
        resp = requests.get(url, timeout=20)
    except Exception:
        # Network error -> skip PNG rendering, do not block save
        return None

    if 500 <= resp.status_code < 600:
        # Server-side error (e.g. 509 Bandwidth Limit) -> skip PNG, do not block save
        return None

    if resp.status_code != 200:
        # 4xx or unexpected -> real error, diagram may be invalid
        raise RuntimeError(f"PlantUML server HTTP {resp.status_code}")

    os.makedirs(output_dir, exist_ok=True)

    try:
        with open(filepath, "wb") as f:
            f.write(resp.content)
    except Exception as exc:
        raise RuntimeError(f"Failed to write PNG file: {exc}") from exc

    return filepath