from pydantic import ValidationError

from app.core.schemas import ProcessInput


def test_process_input_valid():
    data = {
        "process_name": "Order processing",
        "domain": "E-commerce",
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

    process = ProcessInput(**data)

    assert process.process_name == "Order processing"
    assert len(process.actors) == 3
    assert len(process.actions) == 3


def test_process_input_rejects_empty_name():
    data = {
        "process_name": "   ",  # empty after stripping
        "actors": ["Actor"],
        "actions": [{"actor": "Actor", "action": "Some action"}],
    }

    try:
        ProcessInput(**data)
        assert False, "Expected ValidationError for empty process_name"
    except ValidationError as e:
        assert "Process name must not be empty" in str(e)


def test_process_input_rejects_duplicate_actors():
    data = {
        "process_name": "Duplicate actors test",
        "actors": ["Customer", "Customer"],
        "actions": [{"actor": "Customer", "action": "Test action"}],
    }

    try:
        ProcessInput(**data)
        assert False, "Expected ValidationError for duplicate actors"
    except ValidationError as e:
        assert "Actors must not contain duplicates" in str(e)
