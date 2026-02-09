from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


def test_generate_activity_diagram_smoke(monkeypatch):
    from app.api.v1 import endpoints

    # 1) Mock LLM
    def fake_generate_simple_response(messages):
        return "@startuml\nstart\n:Dummy action;\nstop\n@enduml"

    monkeypatch.setattr(endpoints, "generate_simple_response", fake_generate_simple_response)

    # 2) Mock PlantUML validator
    def fake_validate_plantuml(code: str):
        return True, None

    monkeypatch.setattr(endpoints, "validate_plantuml", fake_validate_plantuml)

    payload = {
        "process_name": "Order processing",
        "domain": "E-commerce",
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
    }

    response = client.post("/api/v1/generate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["process_name"] == "Order processing"
    assert "@startuml" in data["plantuml_code"]
    assert "@enduml" in data["plantuml_code"]
    assert data["model_used"]  # pole exists


def test_generate_activity_diagram_invalid_plantuml(monkeypatch):
    from app.api.v1 import endpoints

    def fake_broken_generate_simple_response(messages):
        return "This is not PlantUML at all"

    monkeypatch.setattr(endpoints, "generate_simple_response", fake_broken_generate_simple_response)

    def fake_validate_plantuml(code: str):
        return True, None

    monkeypatch.setattr(endpoints, "validate_plantuml", fake_validate_plantuml)

    payload = {
        "process_name": "Order processing",
        "domain": "E-commerce",
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
    }

    response = client.post("/api/v1/generate", json=payload)

    assert response.status_code == 500
    data = response.json()
    assert "LLM did not return valid PlantUML code" in data["detail"]
