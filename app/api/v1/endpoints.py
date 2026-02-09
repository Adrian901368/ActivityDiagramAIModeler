from fastapi import APIRouter, HTTPException

from app.core.schemas import ProcessInput, GenerateResponse, ErrorResponse
from app.core.prompts import build_activity_diagram_system_prompt
from app.services.llm_service import generate_simple_response
from app.services.plantuml_validator import validate_plantuml
from app.core.config import settings


router = APIRouter()


@router.post(
    "/generate",
    response_model=GenerateResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Generate UML Activity Diagram in PlantUML",
    tags=["generation"],
)
async def generate_activity_diagram(payload: ProcessInput) -> GenerateResponse:
    """
    Main endpoint of the application.

    Takes a structured JSON description of a process (ProcessInput) and
    returns PlantUML code for a UML Activity Diagram based on that input.
    """
    # 1) Build system prompt (rules for PlantUML output)
    system_prompt = build_activity_diagram_system_prompt()

    # 2) Prepare JSON payload for the LLM from validated Pydantic model
    user_content = {
        "process_name": payload.process_name,
        "domain": payload.domain,
        "actors": payload.actors,
        "actions": [a.model_dump() for a in payload.actions],
        "decisions": [d.model_dump() for d in payload.decisions] if payload.decisions else None,
        "parallel_blocks": (
            [pb.model_dump() for pb in payload.parallel_blocks]
            if payload.parallel_blocks
            else None
        ),
    }

    # 3) Build OpenAI‑compatible messages
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                "You will receive a JSON object that describes a business process. "
                "Generate the UML Activity Diagram in PlantUML syntax based on this JSON. "
                "Respond ONLY with PlantUML code. Here is the JSON:\n"
                f"{user_content}"
            ),
        },
    ]

    # 4) Call LLM service
    try:
        plantuml_code = generate_simple_response(messages)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {exc}",
        )

    # 5) Basic sanity check – must contain @startuml/@enduml
    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    # 6) Syntax validation via PlantUML server
    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=500,
            detail=f"Generated PlantUML has syntax errors: {error_msg}",
        )

    # 7) Successful response
    return GenerateResponse(
        plantuml_code=plantuml_code,
        process_name=payload.process_name,
        model_used=settings.llm.model,
        tokens_used=None,  # môžeš doplniť neskôr podľa llm_service
    )
