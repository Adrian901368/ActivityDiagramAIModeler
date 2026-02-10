from typing import Tuple, Optional
import os
import requests

PLANTUML_SERVER_BASE = os.getenv(
    "PLANTUML_SERVER_BASE",
    "https://www.plantuml.com/plantuml",
)


def _encode_hex(code: str) -> str:
    hex_str = code.encode("utf-8").hex()
    return "~h" + hex_str


def validate_plantuml(code: str) -> Tuple[bool, Optional[str]]:
    """
    Returns (is_valid, error_message).

    - True, None               -> syntax OK (alebo validáciu preskakujeme kvôli server erroru)
    - False, "reason message"  -> považujeme za syntaktickú chybu
    """
    if not code or "@startuml" not in code or "@enduml" not in code:
        return False, "Missing @startuml/@enduml in PlantUML code."

    encoded = _encode_hex(code)
    base = PLANTUML_SERVER_BASE.rstrip("/")
    url = f"{base}/png/{encoded}"

    try:
        resp = requests.get(url, timeout=10)
    except Exception as exc:
        # Server nedostupný -> nebudeme blokovať generovanie, len vrátime info do logu
        return True, f"Skipped syntax validation (PlantUML server error: {exc})"

    if resp.status_code == 200:
        # Server úspešne vyrenderoval PNG -> syntax je v poriadku
        return True, None

    if 500 <= resp.status_code < 600:
        # Server-side chyba (napr. 509) -> syntax pravdepodobne OK, len server má problém
        return True, f"Skipped syntax validation (PlantUML server HTTP {resp.status_code})"

    # 4xx alebo iné podozrivé kódy považujeme za error
    return False, f"PlantUML server HTTP {resp.status_code}"
