from fastapi.testclient import TestClient

from app.api.main import app

client = TestClient(app)


def test_generate_from_text_smoke(monkeypatch):
    """
    Happy-path test for /api/v1/generate-from-text.

    We mock both:
    - text -> structure step (generate_structured_prompt_from_text)
    - structure -> PlantUML step (generate_simple_response)
    - PlantUML validator + catalog save
    so that the test je úplne deterministický.
    """
    from app.api.v1 import endpoints

    # 1) Mock text -> structured JSON
    def fake_generate_structured_prompt_from_text(*args, **kwargs):
        return {
            "process_name": "Order processing",
            "actors": ["Customer", "System"],
            "actions": [
                {"actor": "Customer", "action": "Selects product"},
                {"actor": "System", "action": "Checks availability"},
            ],
            "decisions": [
                {
                    "condition": "Items in stock?",
                    "branch_yes": "Confirm order",
                    "branch_no": "Show out-of-stock message",
                }
            ],
            "parallel_branches": [],
            "signals": [],
        }

    monkeypatch.setattr(
        endpoints,
        "generate_structured_prompt_from_text",
        fake_generate_structured_prompt_from_text,
    )

    # 2) Mock LLM PlantUML generation
    def fake_generate_simple_response(messages):
        return "@startuml\nstart\n:Dummy action;\nstop\n@enduml"

    monkeypatch.setattr(
        endpoints,
        "generate_simple_response",
        fake_generate_simple_response,
    )

    # 3) Mock PlantUML validator
    def fake_validate_plantuml(code: str):
        return True, None

    monkeypatch.setattr(endpoints, "validate_plantuml", fake_validate_plantuml)

    # 4) Mock catalog save – no-op
    def fake_save_process_version(
        db,
        process_name,
        domain,
        version_name,
        prompt_dict,
        plantuml_code,
        llm_model,
        tokens_used=None,
    ):
        return None

    monkeypatch.setattr(
        endpoints,
        "save_process_version",
        fake_save_process_version,
    )

    params = {
        "process_name": "Order processing",
        "domain": "E-commerce",
        "version_name": "text-v1",
    }
    body = {
        "description": "Customer selects products and system processes the order."
    }

    response = client.post("/api/v1/generate-from-text", params=params, json=body)

    assert response.status_code == 200
    data = response.json()
    assert data["process_name"] == "Order processing"
    assert "@startuml" in data["plantuml_code"]
    assert "@enduml" in data["plantuml_code"]
    assert data["model_used"]


def test_generate_from_text_invalid_plantuml(monkeypatch):
    """
    If PlantUML validator zistí chybu, endpoint má vrátiť 400.
    """
    from app.api.v1 import endpoints

    # Text -> structure stále vracia validnú štruktúru
    def fake_generate_structured_prompt_from_text(*args, **kwargs):
        return {
            "process_name": "Order processing",
            "actors": ["Customer", "System"],
            "actions": [
                {"actor": "Customer", "action": "Selects product"},
                {"actor": "System", "action": "Checks availability"},
            ],
            "decisions": [],
            "parallel_branches": [],
            "signals": [],
        }

    monkeypatch.setattr(
        endpoints,
        "generate_structured_prompt_from_text",
        fake_generate_structured_prompt_from_text,
    )

    # LLM vygeneruje PlantUML, ale validator ho odmietne
    def fake_generate_simple_response(messages):
        return "@startuml\n@enduml"

    monkeypatch.setattr(
        endpoints,
        "generate_simple_response",
        fake_generate_simple_response,
    )

    def fake_validate_plantuml(code: str):
        return False, "No action nodes found"

    monkeypatch.setattr(endpoints, "validate_plantuml", fake_validate_plantuml)

    params = {
        "process_name": "Order processing",
        "domain": "E-commerce",
        "version_name": "text-v1",
    }
    body = {"description": "Broken description that leads to bad diagram."}

    response = client.post("/api/v1/generate-from-text", params=params, json=body)

    assert response.status_code == 400
    data = response.json()
    assert "Generated PlantUML is invalid" in data["detail"]
    assert "No action nodes found" in data["detail"]
