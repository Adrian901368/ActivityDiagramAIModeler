from fastapi import APIRouter, HTTPException, Depends, status, Response, Query
from sqlalchemy.orm import Session

from app.core.prompts import build_activity_diagram_system_prompt
from app.services import catalog_service
from app.services.llm_service import generate_simple_response
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
    ProcessInput,
    GenerateResponse,
    ErrorResponse,
    CatalogProcessDetail,
    CatalogVersion,
    ProcessInCatalog,
    NewVersionInput,
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
    system_prompt = build_activity_diagram_system_prompt()

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
        )

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
            process_id=v.process_id,
            version_number=v.version_number,
            version_name=(getattr(v, "version_name", "") or ""),
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
    version_name: str = Query("", description="Optional human-friendly name of this version"),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    try:
        version = catalog_service.create_new_version_for_process(
            db=db,
            process_id=process_id,
            plantuml_code=payload.plantuml_code,
            prompt_dict=payload.prompt,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

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
    payload: NewVersionInput,   # len plantuml_code + prompt
    version_name: str = Query(
        "",
        description="Optional name of this version",
    ),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Update PlantUML code (and optional prompt + version_name) for a *draft* version.

    - 404, if (process_id, version_number) does not exist.
    - 400, if version is not in 'draft' status.
    """
    try:
        version = catalog_service.update_draft_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
            plantuml_code=payload.plantuml_code,
            prompt_dict=payload.prompt,
            version_name=version_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

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
        raise HTTPException(status_code=400, detail=str(exc))

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
