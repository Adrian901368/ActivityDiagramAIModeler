from pydantic import ValidationError

from app.core.schemas import ProcessStructureInput


def test_process_structure_input_valid():
    data = {
        "actors": ["Customer", "System", "Warehouse"],
        "actions": [
            {"actor": "Customer", "action": "Selects products"},
            {"actor": "System", "action": "Checks availability"},
            {"actor": "Warehouse", "action": "Prepares package"},
        ],
        "decisions": [
            {
                "condition": "Are all items in stock?",
                "branch_yes": "Proceed to payment",
                "branch_no": "Show out-of-stock information",
            }
        ],
    }

    process = ProcessStructureInput(**data)

    assert len(process.actors) == 3
    assert len(process.actions) == 3
    assert process.decisions is not None
    assert len(process.decisions) == 1


def test_process_structure_rejects_empty_actors_list():
    data = {
        "actors": ["   "],
        "actions": [{"actor": "Actor", "action": "Some action"}],
    }

    try:
        ProcessStructureInput(**data)
        assert False, "Expected ValidationError for empty actors list"
    except ValidationError as e:
        assert "There must be at least one actor" in str(e)


def test_process_structure_rejects_duplicate_actors():
    data = {
        "actors": ["Customer", "Customer"],
        "actions": [{"actor": "Customer", "action": "Test action"}],
    }

    try:
        ProcessStructureInput(**data)
        assert False, "Expected ValidationError for duplicate actors"
    except ValidationError as e:
        assert "Actors must not contain duplicates" in str(e)
