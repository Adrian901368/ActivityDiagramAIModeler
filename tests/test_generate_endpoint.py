from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


def test_generate_activity_diagram_smoke(monkeypatch):
    # Arrange: mock LLM service to avoid real API calls
    from app.api.v1 import endpoints

    async def fake_generate_simple_response(system_prompt, user_payload):
        # return minimal valid PlantUML and fake meta
        code = "@startuml\nstart\n:Dummy action;\nstop\n@enduml"
        meta = {"model": "test-model", "tokens_used": 42}
        return code, meta

    monkeypatch.setattr(endpoints, "generate_simple_response", fake_generate_simple_response)

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

    # Act
    response = client.post("/api/v1/generate", json=payload)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["process_name"] == "Order processing"
    assert "@startuml" in data["plantuml_code"]
    assert "@enduml" in data["plantuml_code"]
    assert data["model_used"] == "test-model"
    assert data["tokens_used"] == 42

def test_generate_activity_diagram_invalid_plantuml(monkeypatch):
    """
    If the LLM returns output that is not valid PlantUML
    (missing @startuml/@enduml), the endpoint should respond with an error.
    """
    from app.api.v1 import endpoints

    # 1) Fake LLM vráti ne-PlantUML text
    async def fake_broken_generate_simple_response(system_prompt, user_payload):
        code = "This is not PlantUML at all"
        meta = {"model": "test-model", "tokens_used": 10}
        return code, meta

    monkeypatch.setattr(
        endpoints, "generate_simple_response", fake_broken_generate_simple_response
    )

    # 2) Použijeme ten istý validný payload ako v smoke teste
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

    # 3) Voláme endpoint
    response = client.post("/api/v1/generate", json=payload)

    # 4) Očakávame server error (podľa toho, ako máš nastavený HTTPException)
    assert response.status_code == 500
    data = response.json()
    # detail text môžeš prispôsobiť presne tomu, čo si dal do HTTPException v endpoints.py
    assert "LLM did not return valid PlantUML code" in data["detail"]