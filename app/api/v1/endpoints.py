# app/api/v1/endpoints.py
from typing import Optional, List, Dict, Any

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    status,
    Response,
    Query,
    Body,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.prompts import build_activity_diagram_system_prompt
from app.services import catalog_service
from app.services.llm_service import (
    generate_simple_response,
    generate_structured_prompt_from_text,
)
from app.services.plantuml_validator import validate_plantuml
from app.services.catalog_service import (
    save_process_version,
    create_new_version_for_process,
    delete_process_with_versions,
    delete_version_for_process,
    publish_version,
    update_draft_version,
)
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Process, Version
from app.core.schemas import (
    ProcessStructureInput,
    GenerateResponse,
    ErrorResponse,
    CatalogProcessDetail,
    CatalogVersion,
    ProcessInCatalog,
    NewVersionInput,
)

router = APIRouter()


class TextGenerateInput(BaseModel):
    """Simple text description input for /generate-from-text."""
    description: str = Field(
        ...,
        description="Free-text description of the business process",
        example="Customer selects products, system checks availability, payment, shipment...",
    )


@router.post(
    "/generate",
    response_model=GenerateResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Generate UML Activity Diagram in PlantUML",
    tags=["generation"],
)
async def generate_activity_diagram(
    process_name: str = Query(
        ...,
        description="Name of the business process",
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human‑readable label for this version (e.g. v1, draft-1)",
    ),
    payload: ProcessStructureInput = Body(...),
    db: Session = Depends(get_db),
) -> GenerateResponse:
    """
    Generate a UML Activity Diagram in PlantUML syntax from structured JSON input.

    - process_name, domain, version_name are query parameters
    - body contains only the process structure (actors, actions, decisions, parallel_blocks)
    """

    system_prompt = build_activity_diagram_system_prompt()

    user_content = {
        "process_name": process_name,
        "domain": domain,
        "version_name": version_name,
        "actors": payload.actors,
        "actions": [a.model_dump() for a in payload.actions],
        "decisions": (
            [d.model_dump() for d in payload.decisions]
            if payload.decisions
            else None
        ),
        "parallel_blocks": (
            [pb.model_dump() for pb in payload.parallel_blocks]
            if payload.parallel_blocks
            else None
        ),
    }

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

    try:
        plantuml_code = generate_simple_response(messages)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {exc}",
        ) from exc

    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=500,
            detail=f"Generated PlantUML has syntax errors: {error_msg}",
        )

    try:
        save_process_version(
            db=db,
            process_name=process_name,
            domain=domain,
            prompt_dict=user_content,
            plantuml_code=plantuml_code,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save process version: {exc}",
        ) from exc

    return GenerateResponse(
        status="success",
        plantuml_code=plantuml_code,
        process_name=process_name,
        tokens_used=None,
        model_used=settings.llm.model,
    )


@router.post(
    "/generate-from-text",
    response_model=GenerateResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Generate UML Activity Diagram from text description",
    tags=["generation"],
)
async def generate_activity_diagram_from_text(
    process_name: str = Query(
        ...,
        description="Name of the business process",
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human‑readable label for this version (e.g. v1, draft-text-1)",
    ),
    payload: TextGenerateInput = Body(...),
    db: Session = Depends(get_db),
) -> GenerateResponse:
    """
    End-to-end pipeline for free-text descriptions:

    1) description -> structured JSON (generate_structured_prompt_from_text)
    2) structured JSON -> PlantUML (same system prompt as /generate)
    3) PlantUML validation + save version to catalog
    """

    # 1) Text -> structured description (English keys and values)
    try:
        structured: Dict[str, Any] = generate_structured_prompt_from_text(
            description=payload.description,
            process_name=process_name,
            domain=domain,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LLM text-to-structure call failed: {exc}",
        ) from exc

    # 2) Read from English-key schema: process_name, actors, actions, decisions, parallel_branches, signals
    actors = structured.get("actors") or []
    raw_actions = structured.get("actions") or []
    raw_decisions = structured.get("decisions") or []
    # Optional, currently ignored in validation / PlantUML, but kept for future:
    raw_parallel = structured.get("parallel_branches") or []

    actions = []
    for item in raw_actions:
        if not isinstance(item, dict):
            continue
        actor = (item.get("actor") or "").strip()
        action = (item.get("action") or "").strip()
        if actor and action:
            actions.append({"actor": actor, "action": action})

    decisions = []
    for item in raw_decisions:
        if not isinstance(item, dict):
            continue
        condition = (item.get("condition") or "").strip()
        yes = (item.get("branch_yes") or "").strip()
        no = (item.get("branch_no") or "").strip()
        if condition and yes and no:
            decisions.append(
                {
                    "condition": condition,
                    "branch_yes": yes,
                    "branch_no": no,
                }
            )

    # For now we ignore parallel_branches / signals when building ProcessStructureInput
    parallel_blocks = None
    if raw_parallel:
        # You could later map this to your ParallelBlockInput model.
        parallel_blocks = None

    # 3) Validate against ProcessStructureInput
    try:
        process_structure = ProcessStructureInput(
            actors=actors,
            actions=actions,
            decisions=decisions or None,
            parallel_blocks=parallel_blocks,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Structured process validation failed: {exc}",
        ) from exc

    # 4) Use the same system prompt and LLM call as in /generate
    system_prompt = build_activity_diagram_system_prompt()

    user_content = {
        "process_name": process_name,
        "domain": domain,
        "version_name": version_name,
        "actors": process_structure.actors,
        "actions": [a.model_dump() for a in process_structure.actions],
        "decisions": (
            [d.model_dump() for d in process_structure.decisions]
            if process_structure.decisions
            else None
        ),
        "parallel_blocks": (
            [pb.model_dump() for pb in process_structure.parallel_blocks]
            if process_structure.parallel_blocks
            else None
        ),
    }

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

    try:
        plantuml_code = generate_simple_response(messages)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {exc}",
        ) from exc

    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=500,
            detail=f"Generated PlantUML has syntax errors: {error_msg}",
        )

    try:
        save_process_version(
            db=db,
            process_name=process_name,
            domain=domain,
            prompt_dict=user_content,
            plantuml_code=plantuml_code,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save process version: {exc}",
        ) from exc

    return GenerateResponse(
        status="success",
        plantuml_code=plantuml_code,
        process_name=process_name,
        tokens_used=None,
        model_used=settings.llm.model,
    )


@router.get(
    "/catalog/processes",
    response_model=List[ProcessInCatalog],
    summary="List all processes in catalog",
    tags=["catalog"],
)
async def list_processes(
    name: str | None = None,
    domain: str | None = None,
    db: Session = Depends(get_db),
) -> List[ProcessInCatalog]:
    """
    Return a list of all processes in the catalog, optionally filtered by
    name and/or domain (case-insensitive substring match).
    """
    return catalog_service.get_all_processes(db, name=name, domain=domain)


@router.get(
    "/catalog/{process_id}",
    response_model=CatalogProcessDetail,
    responses={404: {"model": ErrorResponse}},
    summary="Get catalog entry for a process",
    tags=["catalog"],
)
async def get_process_catalog(
    process_id: int,
    version_name: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> CatalogProcessDetail:
    """
    Return catalog information for a single process, including all
    stored versions and their PlantUML code.

    Optionally filter versions by version_name (substring) and/or status.
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    query = (
        db.query(Version)
        .filter(Version.process_id == process.id)
        .order_by(Version.version_number.desc())
    )

    if version_name:
        query = query.filter(Version.version_name.ilike(f"%{version_name}%"))
    if status:
        query = query.filter(Version.status == status)

    versions = query.all()
    version_items = [
        CatalogVersion(
            id=v.id,
            process_id=v.process_id,
            version_number=v.version_number,
            version_name=v.version_name or "",
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


@router.post(
    "/catalog/{process_id}/versions",
    response_model=CatalogVersion,
    responses={404: {"model": ErrorResponse}},
    summary="Create new version for an existing process",
    tags=["catalog"],
)
async def create_process_version(
    process_id: int,
    payload: NewVersionInput,
    version_name: str = "",
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Create a new version for an existing process using provided PlantUML
    code and optional prompt.
    """
    try:
        version = create_new_version_for_process(
            db=db,
            process_id=process_id,
            plantuml_code=payload.plantuml_code,
            prompt_dict=payload.prompt,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=version.version_name or "",
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
    )


@router.put(
    "/catalog/{process_id}/versions/{version_number}",
    response_model=CatalogVersion,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Update draft version of a process",
    tags=["catalog"],
)
async def update_draft_process_version(
    process_id: int,
    version_number: int,
    payload: NewVersionInput,
    version_name: str = "",
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Update PlantUML code (and optional prompt + version_name) for a *draft* version.

    - 404, if (process_id, version_number) does not exist.
    - 400, if version is not in 'draft' status.
    """
    try:
        version = update_draft_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
            plantuml_code=payload.plantuml_code,
            prompt_dict=payload.prompt,
            version_name=version_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_number} for process {process_id} not found.",
        )

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=version.version_name or "",
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
    )


@router.delete(
    "/catalog/{process_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
    summary="Delete process and all its versions",
    tags=["catalog"],
)
async def delete_process(
    process_id: int,
    db: Session = Depends(get_db),
) -> Response:
    """
    Delete a process from the catalog, including all its stored versions.
    """
    deleted = delete_process_with_versions(db, process_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/catalog/{process_id}/versions/{version_number}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
    summary="Delete a specific version of a process",
    tags=["catalog"],
)
async def delete_process_version(
    process_id: int,
    version_number: int,
    db: Session = Depends(get_db),
) -> Response:
    """
    Delete a single version identified by (process_id, version_number).
    """
    deleted = delete_version_for_process(
        db=db,
        process_id=process_id,
        version_number=version_number,
    )
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_number} for process {process_id} not found.",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/catalog/{process_id}/versions/{version_number}/publish",
    response_model=CatalogVersion,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Publish version for a process",
    tags=["catalog"],
)
async def publish_process_version(
    process_id: int,
    version_number: int,
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Publish a specific version of a process.

    - Selected version (draft/archived) becomes 'active'.
    - All other versions of the process become 'archived'.
    - If version is already 'active' -> 400.
    """
    try:
        version = publish_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_number} for process {process_id} not found.",
        )

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=(version.version_name or ""),
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
    )
