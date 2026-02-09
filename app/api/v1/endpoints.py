from fastapi import APIRouter, HTTPException
from app.core.schemas import ProcessInput, GenerateResponse, ErrorResponse
from app.core.prompts import build_activity_diagram_system_prompt
from app.services.llm_service import generate_simple_response


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
    try:
        system_prompt = build_activity_diagram_system_prompt()

        # We send the validated JSON representation of the process to the LLM.
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

        # Call the LLM service – this function should:
        # - accept system + user messages
        # - return plain text (PlantUML code) from the model
        plantuml_code, meta = await generate_simple_response(
            system_prompt=system_prompt,
            user_payload=user_content,
        )

        if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
            raise HTTPException(
                status_code=500,
                detail="LLM did not return valid PlantUML code.",
            )

        return GenerateResponse(
            plantuml_code=plantuml_code,
            process_name=payload.process_name,
            model_used=meta.get("model", "unknown"),
            tokens_used=meta.get("tokens_used"),
        )

    except HTTPException:
        # necháme FastAPI spracovať HTTPException
        raise
    except Exception as exc:
        # fallback na general error
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during diagram generation: {exc}",
        )
