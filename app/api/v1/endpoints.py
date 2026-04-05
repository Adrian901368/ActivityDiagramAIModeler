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
from app.services.plantuml_validator import (
    validate_plantuml,
    render_plantuml_to_png,
)
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
    """Simple text description input for text-based generation endpoints."""

    description: str = Field(
        ...,
        description="Free-text description of the business process",
        json_schema_extra={
            "example": (
                "Customer selects products in the e-shop, system checks stock, "
                "if all items are available the customer pays and the system "
                "confirms the order, otherwise the system shows an out-of-stock "
                "message and the customer edits the cart."
            )
        },
    )


def _build_process_structure_from_structured_dict(
    structured: Dict[str, Any],
) -> ProcessStructureInput:
    """
    Convert a structured dict returned by the LLM into ProcessStructureInput.

    This helper normalizes the raw JSON (filters out invalid items) and then
    leverages Pydantic validation (actors, actions, decisions).
    """
    actors = structured.get("actors") or []
    raw_actions = structured.get("actions") or []
    raw_decisions = structured.get("decisions") or []
    raw_parallel = structured.get("parallel_branches") or []

    # Normalize actions
    actions: List[Dict[str, Any]] = []
    for item in raw_actions:
        if not isinstance(item, dict):
            continue
        actor = (item.get("actor") or "").strip()
        action = (item.get("action") or "").strip()
        if actor and action:
            actions.append({"actor": actor, "action": action})

    # Normalize decisions (including new index fields)
    decisions: List[Dict[str, Any]] = []
    for item in raw_decisions:
        if not isinstance(item, dict):
            continue

        condition = (item.get("condition") or "").strip()
        yes = (item.get("branch_yes") or "").strip()
        no = (item.get("branch_no") or "").strip()

        # Accept both snake_case and camelCase / fallback variations
        yes_index_raw = (
            item.get("yes_action_index")
            if "yes_action_index" in item
            else item.get("yesActionIndex")
        )
        no_index_raw = (
            item.get("no_action_index")
            if "no_action_index" in item
            else item.get("noActionIndex")
        )

        # Coerce indices to int | None, ignoring invalid values
        def _to_optional_int(value: Any) -> Optional[int]:
            if value is None:
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        yes_index = _to_optional_int(yes_index_raw)
        no_index = _to_optional_int(no_index_raw)

        if condition and yes and no:
            decision_dict: Dict[str, Any] = {
                "condition": condition,
                "branch_yes": yes,
                "branch_no": no,
            }
            # Only include indices if they are not None.
            # Range validity is checked later by ProcessStructureInput validator.
            if yes_index is not None:
                decision_dict["yes_action_index"] = yes_index
            if no_index is not None:
                decision_dict["no_action_index"] = no_index

            decisions.append(decision_dict)

    # For now we do not map parallel_branches into ParallelBlock structures.
    # This can be extended later when the visual editor supports parallel flows.
    parallel_blocks = None
    if raw_parallel:
        parallel_blocks = None

    return ProcessStructureInput(
        actors=actors,
        actions=actions,
        decisions=decisions or None,
        parallel_blocks=parallel_blocks,
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
        examples={"example": {"value": "Order processing"}},
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
        examples={"example": {"value": "E-commerce"}},
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human‑readable label for this version (e.g. v1, draft-1)",
        examples={"example": {"value": "v1 - initial draft"}},
    ),
    payload: ProcessStructureInput = Body(...),
) -> GenerateResponse:
    """
    Generate a UML Activity Diagram in PlantUML syntax from structured JSON input.

    This endpoint ONLY generates and validates PlantUML code.
    It does NOT save anything to the database – saving is handled
    by separate catalog endpoints.
    """
    system_prompt = build_activity_diagram_system_prompt()

    user_content: Dict[str, Any] = {
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

    if (
        not plantuml_code
        or "@startuml" not in plantuml_code
        or "@enduml" not in plantuml_code
    ):
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Generated PlantUML is invalid: {error_msg}",
        )

    return GenerateResponse(
        status="success",
        plantuml_code=plantuml_code,
        process_name=process_name,
        tokens_used=None,
        model_used=settings.llm.model,
        prompt=user_content,
    )


@router.post(
    "/generate-structure",
    response_model=ProcessStructureInput,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Generate structured process JSON from text description",
    tags=["generation"],
)
async def generate_process_structure_from_text(
    process_name: str = Query(
        ...,
        description="Name of the business process",
        examples={"example": {"value": "Order processing"}},
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
        examples={"example": {"value": "E-commerce"}},
    ),
    payload: TextGenerateInput = Body(...),
) -> ProcessStructureInput:
    """
    Convert a free-text description of a process into structured JSON.

    This endpoint:
    1) Calls the LLM to produce a structured JSON description.
    2) Normalizes the raw JSON and validates it against ProcessStructureInput.

    It does NOT generate PlantUML and does NOT save anything to the database.
    It is intended as an input for the interactive visual editor on the frontend.
    """
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

    try:
        process_structure = _build_process_structure_from_structured_dict(structured)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Structured process validation failed: {exc}",
        ) from exc

    return process_structure


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
        examples={"example": {"value": "Order processing"}},
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
        examples={"example": {"value": "E-commerce"}},
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human‑readable label for this version (e.g. v1, draft-text-1)",
        examples={"example": {"value": "v1 - text initial draft"}},
    ),
    payload: TextGenerateInput = Body(...),
) -> GenerateResponse:
    """
    End-to-end pipeline for free-text descriptions:

    1) description -> structured JSON (generate_structured_prompt_from_text)
    2) structured JSON -> PlantUML (same system prompt as /generate)
    3) PlantUML validation

    This endpoint ONLY generates and validates PlantUML code.
    It does NOT save anything to the database – saving is handled
    by separate catalog endpoints.
    """
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

    try:
        process_structure = _build_process_structure_from_structured_dict(structured)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Structured process validation failed: {exc}",
        ) from exc

    system_prompt = build_activity_diagram_system_prompt()

    user_content: Dict[str, Any] = {
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

    if (
        not plantuml_code
        or "@startuml" not in plantuml_code
        or "@enduml" not in plantuml_code
    ):
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Generated PlantUML is invalid: {error_msg}",
        )

    return GenerateResponse(
        status="success",
        plantuml_code=plantuml_code,
        process_name=process_name,
        tokens_used=None,
        model_used=settings.llm.model,
        prompt=user_content,
    )


@router.post(
    "/catalog/save-from-structure",
    response_model=CatalogVersion,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary=(
        "Generate PlantUML from structured JSON and save as a new draft version "
        "(intended for visual editor)"
    ),
    tags=["catalog"],
)
async def save_version_from_structure(
    process_name: str = Query(
        ...,
        description="Name of the business process (used to find or create Process)",
        examples={"example": {"value": "Order processing"}},
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
        examples={"example": {"value": "E-commerce"}},
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human-readable label for this version (e.g. v1, editor-draft-1)",
        examples={"example": {"value": "v1 - edited draft"}},
    ),
    payload: ProcessStructureInput = Body(
        ...,
        description="Canonical JSON structure of the process (from visual editor)",
    ),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Full pipeline for visual editor:

    1) Takes canonical JSON structure (ProcessStructureInput) from the client.
    2) Generates PlantUML via LLM using the same system prompt as /generate.
    3) Validates PlantUML with PlantUML server.
    4) Renders PNG via PlantUML server and stores its path.
    5) Saves a new *draft* Version in the catalog.

    This endpoint is intended to be called when the user clicks "Save" in the
    interactive visual editor. It returns the saved version including PlantUML
    code so the frontend can show both the text and rendered diagram.
    """
    system_prompt = build_activity_diagram_system_prompt()

    user_content: Dict[str, Any] = {
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

    if (
        not plantuml_code
        or "@startuml" not in plantuml_code
        or "@enduml" not in plantuml_code
    ):
        raise HTTPException(
            status_code=500,
            detail="LLM did not return valid PlantUML code.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Generated PlantUML is invalid: {error_msg}",
        )

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render PlantUML diagram: {exc}",
        ) from exc

    try:
        version = save_process_version(
            db=db,
            process_name=process_name,
            domain=domain,
            prompt_dict=user_content,
            plantuml_code=plantuml_code,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
            image_path=image_path,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save process version: {exc}",
        ) from exc

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
        image_path=version.image_path,
    )


@router.post(
    "/catalog/save",
    response_model=CatalogVersion,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Save generated PlantUML as a new draft version (by process name & domain)",
    tags=["catalog"],
)
async def save_generated_version(
    process_name: str = Query(
        ...,
        description="Name of the business process (will be used to find or create Process)",
        examples={"example": {"value": "Order processing"}},
    ),
    domain: str = Query(
        ...,
        description="Domain/category of the process",
        examples={"example": {"value": "E-commerce"}},
    ),
    version_name: Optional[str] = Query(
        default=None,
        description="Optional human-readable label for this version (e.g. v1, draft-1)",
        examples={"example": {"value": "v1 - initial draft"}},
    ),
    payload: NewVersionInput = Body(
        ...,
        description="PlantUML code (and optional prompt metadata) to be saved as a new version",
    ),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Save a generated PlantUML diagram as a new draft Version in the catalog.

    - Finds or creates Process by (process_name, domain).
    - Validates PlantUML.
    - Renders PNG via PlantUML server and stores its path.
    - Creates a new Version row with auto-incremented version_number.
    - Status is set to 'draft' by default.
    """
    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must not be empty.",
        )

    # Basic sanity check to avoid saving obviously broken diagrams
    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must contain @startuml and @enduml.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"PlantUML validation failed before save: {error_msg}",
        )

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render PlantUML diagram: {exc}",
        ) from exc

    try:
        version = save_process_version(
            db=db,
            process_name=process_name,
            domain=domain,
            prompt_dict=payload.prompt,
            plantuml_code=plantuml_code,
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
            image_path=image_path,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save process version: {exc}",
        ) from exc

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
        image_path=version.image_path,
    )


@router.get(
    "/catalog/processes",
    response_model=List[ProcessInCatalog],
    summary="List all processes in catalog",
    tags=["catalog"],
)
async def list_processes(
    name: str | None = Query(
        default=None,
        description="Substring of process name (case-insensitive)",
    ),
    domain: str | None = Query(
        default=None,
        description="Substring of domain (case-insensitive)",
    ),
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
    version_name: str | None = Query(
        default=None,
        description="Substring of version name to filter versions",
    ),
    status: str | None = Query(
        default=None,
        description="Version status filter: draft, active, archived",
    ),
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
            image_path=v.image_path,
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
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Create new draft version for an existing process (from PlantUML)",
    tags=["catalog"],
)
async def create_process_version(
    process_id: int,
    payload: NewVersionInput,
    version_name: str = Query(
        "",
        description="Optional human-friendly name of this version",
    ),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Create a new *draft* version for an existing process using already generated PlantUML.

    This endpoint does NOT call the LLM. It assumes that PlantUML was generated
    and inspected before, and only handles validation + saving to the catalog.
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must not be empty.",
        )

    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must contain @startuml and @enduml.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"PlantUML validation failed before save: {error_msg}",
        )

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render PlantUML diagram: {exc}",
        ) from exc

    try:
        version = create_new_version_for_process(
            db=db,
            process_id=process_id,
            plantuml_code=plantuml_code,
            prompt_dict=payload.prompt or {},
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
            image_path=image_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save new version: {exc}",
        ) from exc

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
        image_path=version.image_path,
    )


@router.put(
    "/catalog/{process_id}/versions/{version_number}",
    response_model=CatalogVersion,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Update existing draft version with new PlantUML",
    tags=["catalog"],
)
async def update_draft_process_version(
    process_id: int,
    version_number: int,
    payload: NewVersionInput,
    version_name: str = Query(
        "",
        description="Optional name of this version (if empty, keeps current name)",
    ),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Update an existing *draft* version using already generated (and inspected) PlantUML.

    This endpoint does NOT call the LLM. It only validates the provided PlantUML,
    re-renders PNG diagram, and updates the corresponding draft version in the catalog.
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    version = (
        db.query(Version)
        .filter(
            Version.process_id == process_id,
            Version.version_number == version_number,
        )
        .first()
    )
    if version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_number} for process {process_id} not found.",
        )

    if version.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft versions can be modified.",
        )

    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must not be empty.",
        )

    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(
            status_code=400,
            detail="plantuml_code must contain @startuml and @enduml.",
        )

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"PlantUML validation failed before save: {error_msg}",
        )

    # Keep existing version name if none is provided
    new_version_name = version_name or (version.version_name or "")

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render PlantUML diagram: {exc}",
        ) from exc

    try:
        updated = update_draft_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
            plantuml_code=plantuml_code,
            prompt_dict=payload.prompt or {},
            version_name=new_version_name,
            image_path=image_path,
        )
    except ValueError as exc:
        # e.g. status != 'draft' inside service (extra safety)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update draft version: {exc}",
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_number} for process {process_id} not found.",
        )

    return CatalogVersion(
        id=updated.id,
        process_id=updated.process_id,
        version_number=updated.version_number,
        version_name=updated.version_name or "",
        created_at=updated.created_at,
        llm_model=updated.llm_model,
        tokens_used=updated.tokens_used,
        status=updated.status,
        plantuml_code=updated.plantuml_code,
        image_path=updated.image_path,
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


@router.delete(
    "/catalog",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete ALL processes and their versions",
    tags=["catalog"],
)
async def clear_catalog(
    db: Session = Depends(get_db),
) -> Response:
    """
    Hard-delete all processes and all their versions from the catalog.
    """
    try:
        db.query(Version).delete()
        db.query(Process).delete()
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear catalog: {exc}",
        ) from exc

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
        image_path=version.image_path,
    )
