import os
from typing import Tuple, Optional

import requests


PLANTUML_SERVER_BASE = os.getenv(
    "PLANTUML_SERVER_BASE",
    "https://www.plantuml.com/plantuml",
)


def _encode_hex(code: str) -> str:
    """
    Encode PlantUML text using the simple HEX format supported by
    PlantUML server.

    According to PlantUML docs, HEX format is:
      ~h + hex-encoded UTF-8 bytes of the diagram text.
    Example URL:
      https://www.plantuml.com/plantuml/png/~h407374617274756d6c...
    """
    # UTF-8 bytes -> hex string
    hex_str = code.encode("utf-8").hex()
    return "~h" + hex_str


def validate_plantuml(code: str) -> Tuple[bool, Optional[str]]:
    """
    Validate PlantUML code using a PlantUML HTTP server.

    Returns:
        (is_valid, error_message)

    Implementation:
    - Encode the diagram text using HEX encoding with ~h prefix.
    - Send a GET request to {PLANTUML_SERVER_BASE}/png/{encoded}
      (format png is arbitrary; we only care about headers).
    - If the server returns special error headers
      X-PlantUML-Diagram-Error / X-PlantUML-Diagram-Error-Line,
      treat it as a syntax error.
    """
    if not code or "@startuml" not in code or "@enduml" not in code:
        return False, "Missing @startuml/@enduml in PlantUML code."

    encoded = _encode_hex(code)

    # Compose URL: e.g. http://www.plantuml.com/plantuml/png/~h4073...
    base = PLANTUML_SERVER_BASE.rstrip("/")
    url = f"{base}/png/{encoded}"

    try:
        resp = requests.get(url, timeout=10)

    except Exception as exc:
        return False, f"Error calling PlantUML server: {exc}"

    if resp.status_code >= 400:
        return False, f"PlantUML server HTTPS {resp.status_code}: {resp.text[:200]}"

    # PlantUML server sets special headers on syntax error
    # https://forum.plantuml.net/6434/how-to-detect-error-in-plantuml-server-rendering
    error_header = resp.headers.get("X-PlantUML-Diagram-Error")
    error_line = resp.headers.get("X-PlantUML-Diagram-Error-Line")

    if error_header:
        msg = f"Syntax error reported by PlantUML server: {error_header}"
        if error_line:
            msg += f" (line {error_line})"
        return False, msg

    # No error header -> syntax is OK
    return True, None
