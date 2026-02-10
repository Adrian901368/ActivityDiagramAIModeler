from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.prompts import build_activity_diagram_system_prompt
from app.services.llm_service import generate_simple_response
from app.services.plantuml_validator import validate_plantuml
from app.services.catalog_service import save_process_version
from app.core.config import settings
from app.database.session import get_db
from app.core.schemas import ProcessInCatalog
from app.services import catalog_service

from app.database.models import Process, Version
from app.core.schemas import (
    ProcessInput,
    GenerateResponse,
    ErrorResponse,
    CatalogProcessDetail,
    CatalogVersion,
)

router = APIRouter()


@router.post(
    "/generate",
    response_model=GenerateResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Generate UML Activity Diagram in PlantUML",
    tags=["generation"],
)
async def generate_activity_diagram(
    payload: ProcessInput,
    db: Session = Depends(get_db),
) -> GenerateResponse:
    """
    Main endpoint of the application.

    Takes a structured JSON description of a process (ProcessInput) and
    returns PlantUML code for a UML Activity Diagram based on that input.
    Additionally, each successful generation is stored in the model catalog
    as a new version of the given process.
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

    # 6) Syntax validation via PlantUML server (HTTPS)
    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=500,
            detail=f"Generated PlantUML has syntax errors: {error_msg}",
        )

    # 7) Save to catalog as a new version of the process
    try:
        save_process_version(
            db=db,
            process_name=payload.process_name,
            domain=payload.domain,
            prompt_dict=user_content,
            plantuml_code=plantuml_code,
            llm_model=settings.llm.model,
            tokens_used=None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save process version: {exc}",
        )

    # 8) Successful response
    return GenerateResponse(
        plantuml_code=plantuml_code,
        process_name=payload.process_name,
        model_used=settings.llm.model,
        tokens_used=None,
    )


@router.get(
    "/catalog/processes",
    response_model=list[ProcessInCatalog],
    summary="List all processes in catalog",
    tags=["catalog"],
)
async def list_processes(
    db: Session = Depends(get_db),
) -> list[ProcessInCatalog]:
    """
    Return a list of all processes in the catalog
    (without PlantUML code, only basic metadata).
    """
    return catalog_service.get_all_processes(db)

@router.get(
    "/catalog/{process_id}",
    response_model=CatalogProcessDetail,
    responses={404: {"model": ErrorResponse}},
    summary="Get catalog entry for a process",
    tags=["catalog"],
)
async def get_process_catalog(
    process_id: int,
    db: Session = Depends(get_db),
) -> CatalogProcessDetail:
    """
    Return catalog information for a single process, including all
    stored versions and their PlantUML code.
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    versions = (
        db.query(Version)
        .filter(Version.process_id == process.id)
        .order_by(Version.version_number.desc())
        .all()
    )

    version_items = [
        CatalogVersion(
            id=v.id,
            version_number=v.version_number,
            created_at=v.created_at,
            llm_model=v.llm_model,
            tokens_used=v.tokens_used,
            status=v.status,
            plantuml_code=v.plantuml_code,
        )
        for v in versions
    ]

    return CatalogProcessDetail(
        process_id=process.id,
        process_name=process.name,
        domain=process.domain,
        versions=version_items,
    )
