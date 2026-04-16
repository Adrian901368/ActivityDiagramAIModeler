# app/api/v1/endpoints.py

from typing import Optional, List, Dict, Any

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Header,
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
    make_process_public,
    get_public_processes,
    get_public_process_detail,
    clone_public_process,
    delete_public_process,
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
    LoginRequest,
    LoginResponse,
    MakePublicRequest,
    PublicCatalogProcess,
    PublicCatalogVersion,
    PublicCatalogListItem,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def get_current_user(
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
) -> str:
    """
    Reads X-User-Email header and validates it against the allowed accounts list.
    Returns 401 (not 422) when the header is missing or the email is unknown.
    """
    if not x_user_email or not x_user_email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Email header is required.",
        )
    if x_user_email.strip() not in settings.auth.allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: unknown user email.",
        )
    return x_user_email.strip()


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------

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


class UpdateProcessInput(BaseModel):
    """Payload for updating process name and/or description."""

    name: str = Field(..., min_length=1, max_length=200, description="New process name")
    description: Optional[str] = Field(
        default=None,
        description="Updated process description (null clears it)",
    )


class CloneRequest(BaseModel):
    """Payload for cloning a public process."""

    active_only: bool = Field(
        default=False,
        description="If true, clone only the active version. If false, clone all versions.",
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

    actions: List[Dict[str, Any]] = []
    for item in raw_actions:
        if not isinstance(item, dict):
            continue
        actor = (item.get("actor") or "").strip()
        action = (item.get("action") or "").strip()
        if actor and action:
            actions.append({"actor": actor, "action": action})

    decisions: List[Dict[str, Any]] = []
    for item in raw_decisions:
        if not isinstance(item, dict):
            continue

        condition = (item.get("condition") or "").strip()
        yes = (item.get("branch_yes") or "").strip()
        no = (item.get("branch_no") or "").strip()

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
            if yes_index is not None:
                decision_dict["yes_action_index"] = yes_index
            if no_index is not None:
                decision_dict["no_action_index"] = no_index
            decisions.append(decision_dict)

    parallel_blocks = None
    if raw_parallel:
        parallel_blocks = None

    return ProcessStructureInput(
        actors=actors,
        actions=actions,
        decisions=decisions or None,
        parallel_blocks=parallel_blocks,
    )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/auth/login",
    response_model=LoginResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Log in with email and password",
    tags=["auth"],
)
async def login(payload: LoginRequest = Body(...)) -> LoginResponse:
    """
    Validate credentials against the hardcoded list of allowed STU test accounts.
    Returns the authenticated email on success.
    Raises 401 with 'Invalid credentials' on failure.
    """
    if not settings.auth.is_valid(payload.email, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return LoginResponse(success=True, email=payload.email)


# ---------------------------------------------------------------------------
# Generation endpoints (no auth required — stateless, no DB writes)
# ---------------------------------------------------------------------------

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
        description="Optional human-readable label for this version (e.g. v1, draft-1)",
        examples={"example": {"value": "v1 - initial draft"}},
    ),
    payload: ProcessStructureInput = Body(...),
) -> GenerateResponse:
    """
    Generate a UML Activity Diagram in PlantUML syntax from structured JSON input.
    This endpoint ONLY generates and validates PlantUML code.
    It does NOT save anything to the database.
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
        raise HTTPException(status_code=500, detail=f"LLM call failed: {exc}") from exc

    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=500, detail="LLM did not return valid PlantUML code.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Generated PlantUML is invalid: {error_msg}")

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
    Does NOT generate PlantUML and does NOT save anything to the database.
    """
    try:
        structured: Dict[str, Any] = generate_structured_prompt_from_text(
            description=payload.description,
            process_name=process_name,
            domain=domain,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM text-to-structure call failed: {exc}") from exc

    try:
        process_structure = _build_process_structure_from_structured_dict(structured)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Structured process validation failed: {exc}") from exc

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
        description="Optional human-readable label for this version (e.g. v1, draft-text-1)",
        examples={"example": {"value": "v1 - text initial draft"}},
    ),
    payload: TextGenerateInput = Body(...),
) -> GenerateResponse:
    """
    End-to-end pipeline for free-text descriptions:
    1) description -> structured JSON
    2) structured JSON -> PlantUML
    3) PlantUML validation
    Does NOT save anything to the database.
    """
    try:
        structured: Dict[str, Any] = generate_structured_prompt_from_text(
            description=payload.description,
            process_name=process_name,
            domain=domain,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM text-to-structure call failed: {exc}") from exc

    try:
        process_structure = _build_process_structure_from_structured_dict(structured)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Structured process validation failed: {exc}") from exc

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
        raise HTTPException(status_code=500, detail=f"LLM call failed: {exc}") from exc

    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=500, detail="LLM did not return valid PlantUML code.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Generated PlantUML is invalid: {error_msg}")

    return GenerateResponse(
        status="success",
        plantuml_code=plantuml_code,
        process_name=process_name,
        tokens_used=None,
        model_used=settings.llm.model,
        prompt=user_content,
    )


# ---------------------------------------------------------------------------
# Catalog endpoints (all require X-User-Email header)
# ---------------------------------------------------------------------------

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
    process_name: str = Query(...),
    domain: str = Query(...),
    version_name: Optional[str] = Query(default=None),
    process_description: Optional[str] = Query(default=None),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    payload: ProcessStructureInput = Body(...),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Full pipeline for visual editor:
    1) Takes canonical JSON structure from the client.
    2) Generates PlantUML via LLM.
    3) Validates PlantUML.
    4) Renders PNG and stores its path.
    5) Saves a new draft Version in the catalog.
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
        raise HTTPException(status_code=500, detail=f"LLM call failed: {exc}") from exc

    if not plantuml_code or "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=500, detail="LLM did not return valid PlantUML code.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Generated PlantUML is invalid: {error_msg}")

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render PlantUML diagram: {exc}") from exc

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
            version_description=None,
            image_path=image_path,
            canvas_state=None,
            process_description=process_description,
            owner_email=x_user_email,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save process version: {exc}") from exc

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=version.version_name or "",
        version_description=version.version_description,
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
        image_path=version.image_path,
        prompt=version.prompt,
        canvas_state=version.canvas_state,
    )


@router.post(
    "/catalog/save",
    response_model=CatalogVersion,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Save generated PlantUML as a new draft version (by process name & domain)",
    tags=["catalog"],
)
async def save_generated_version(
    process_name: str = Query(...),
    domain: str = Query(...),
    version_name: Optional[str] = Query(default=None),
    process_description: Optional[str] = Query(default=None),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    payload: NewVersionInput = Body(...),
    db: Session = Depends(get_db),
) -> CatalogVersion:
    """
    Save a generated PlantUML diagram as a new draft Version in the catalog.
    """
    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must not be empty.")

    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must contain @startuml and @enduml.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"PlantUML validation failed before save: {error_msg}")

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render PlantUML diagram: {exc}") from exc

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
            version_description=payload.version_description,
            image_path=image_path,
            canvas_state=payload.canvas_state,
            process_description=process_description,
            owner_email=x_user_email,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save process version: {exc}") from exc

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=version.version_name or "",
        version_description=version.version_description,
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
        image_path=version.image_path,
        prompt=version.prompt,
        canvas_state=version.canvas_state,
    )


@router.get(
    "/catalog/processes",
    response_model=List[ProcessInCatalog],
    summary="List all local processes in catalog",
    tags=["catalog"],
)
async def list_processes(
    name: str | None = Query(default=None),
    domain: str | None = Query(default=None),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> List[ProcessInCatalog]:
    """
    Return a list of all LOCAL processes in the catalog belonging to the
    authenticated user, optionally filtered by name and/or domain.
    """
    return catalog_service.get_all_processes(
        db,
        owner_email=owner_email,
        name=name,
        domain=domain,
    )


# ---------------------------------------------------------------------------
# Public catalog endpoints
# NOTE: /catalog/public and /catalog/public/{process_id} MUST be registered
# BEFORE /catalog/{process_id} to prevent FastAPI from treating 'public'
# as an integer process_id path param.
# ---------------------------------------------------------------------------

@router.get(
    "/catalog/public",
    response_model=List[PublicCatalogListItem],
    summary="List all public processes (visible to all authenticated users)",
    tags=["catalog-public"],
)
async def list_public_processes(
    name: str | None = Query(default=None, description="Substring of process name"),
    owner: str | None = Query(default=None, description="Substring of owner email"),
    domain: str | None = Query(default=None, description="Substring of domain"),
    db: Session = Depends(get_db),
    _owner_email: str = Depends(get_current_user),
) -> List[PublicCatalogListItem]:
    return get_public_processes(db, name=name, owner=owner, domain=domain)


@router.get(
    "/catalog/public/{process_id}",
    response_model=PublicCatalogProcess,
    responses={404: {"model": ErrorResponse}},
    summary="Get full detail of a public process including all versions",
    tags=["catalog-public"],
)
async def get_public_process_detail_endpoint(
    process_id: int,
    db: Session = Depends(get_db),
    _owner_email: str = Depends(get_current_user),
) -> PublicCatalogProcess:
    """
    Return full detail for a single public process including all its versions.
    Every authenticated user can view any public process.
    Returns 404 if the process does not exist or is not public.
    """
    detail = get_public_process_detail(db, process_id=process_id)
    if detail is None:
        raise HTTPException(
            status_code=404,
            detail=f"Public process with id {process_id} not found.",
        )
    return detail


# ---------------------------------------------------------------------------
# Private catalog — single process detail and mutations
# ---------------------------------------------------------------------------

@router.get(
    "/catalog/{process_id}",
    response_model=CatalogProcessDetail,
    responses={404: {"model": ErrorResponse}},
    summary="Get catalog entry for a process",
    tags=["catalog"],
)
async def get_process_catalog(
    process_id: int,
    version_name: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> CatalogProcessDetail:
    """
    Return catalog information for a single local process, including all
    stored versions. Returns 404 if the process does not exist or does not
    belong to the authenticated user.
    """
    process = (
        db.query(Process)
        .filter(
            Process.id == process_id,
            Process.owner_email == owner_email,
            Process.access == "local",
        )
        .first()
    )
    if process is None:
        raise HTTPException(status_code=404, detail=f"Process with id {process_id} not found.")

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
            version_description=v.version_description,
            created_at=v.created_at,
            llm_model=v.llm_model,
            tokens_used=v.tokens_used,
            status=v.status,
            plantuml_code=v.plantuml_code,
            image_path=v.image_path,
            prompt=v.prompt,
            canvas_state=v.canvas_state,
        )
        for v in versions
    ]

    return CatalogProcessDetail(
        process_id=process.id,
        process_name=process.name,
        domain=process.domain,
        description=process.description,
        versions=version_items,
    )


@router.patch(
    "/catalog/{process_id}",
    response_model=CatalogProcessDetail,
    responses={404: {"model": ErrorResponse}},
    summary="Update process name and/or description",
    tags=["catalog"],
)
async def update_process(
    process_id: int,
    payload: UpdateProcessInput,
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> CatalogProcessDetail:
    """
    Update the name and/or description of an existing local process.
    Only the owner of the process can update it.
    """
    process = (
        db.query(Process)
        .filter(
            Process.id == process_id,
            Process.owner_email == owner_email,
            Process.access == "local",
        )
        .first()
    )
    if process is None:
        raise HTTPException(status_code=404, detail=f"Process with id {process_id} not found.")

    process.name = payload.name.strip()
    process.description = payload.description
    db.commit()
    db.refresh(process)

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
            version_name=v.version_name or "",
            version_description=v.version_description,
            created_at=v.created_at,
            llm_model=v.llm_model,
            tokens_used=v.tokens_used,
            status=v.status,
            plantuml_code=v.plantuml_code,
            image_path=v.image_path,
            prompt=v.prompt,
            canvas_state=v.canvas_state,
        )
        for v in versions
    ]

    return CatalogProcessDetail(
        process_id=process.id,
        process_name=process.name,
        domain=process.domain,
        description=process.description,
        versions=version_items,
    )


@router.post(
    "/catalog/{process_id}/make-public",
    response_model=PublicCatalogProcess,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
    summary="Make a local process public (creates a public copy)",
    tags=["catalog-public"],
)
async def make_process_public_endpoint(
    process_id: int,
    payload: MakePublicRequest = Body(...),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> PublicCatalogProcess:
    """
    Create a public copy of a local process owned by the authenticated user.

    mode='active_only'  -> copies only versions with status='active'
    mode='all_versions' -> copies versions with status IN ('active', 'archived')
    Draft versions are NEVER included regardless of mode.

    Returns 404 if the process does not exist or does not belong to the user.
    Returns 400 if there are no qualifying versions to publish.
    """
    public_process = make_process_public(
        db=db,
        process_id=process_id,
        owner_email=owner_email,
        mode=payload.mode,
    )
    if public_process is None:
        raise HTTPException(
            status_code=404,
            detail=f"Process with id {process_id} not found.",
        )

    if not public_process.versions:
        db.delete(public_process)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="No qualifying versions to publish. Make at least one version active or archived first.",
        )

    return PublicCatalogProcess(
        id=public_process.id,
        name=public_process.name,
        domain=public_process.domain,
        description=public_process.description,
        owner_email=public_process.owner_email,
        versions=[
            PublicCatalogVersion(
                id=v.id,
                version_number=v.version_number,
                version_name=v.version_name or "",
                version_description=v.version_description,
                status=v.status,
                created_at=v.created_at,
                llm_model=v.llm_model,
                plantuml_code=v.plantuml_code,
                image_path=v.image_path,
                canvas_state=v.canvas_state,
                prompt=v.prompt,
            )
            for v in public_process.versions
        ],
    )


@router.post(
    "/catalog/public/{process_id}/clone",
    response_model=CatalogProcessDetail,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
    summary="Clone a public process into the authenticated user's local catalog",
    tags=["catalog-public"],
)
async def clone_public_process_endpoint(
    process_id: int,
    payload: CloneRequest = Body(...),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> CatalogProcessDetail:
    """
    Clone a public process into the local catalog of the authenticated user.

    payload.active_only=false -> clone all versions (default)
    payload.active_only=true  -> clone only the active version

    Creates a new local Process with new ids. The clone is fully editable.
    Returns 404 if the public process does not exist.
    Returns 400 if active_only=true but the process has no active version.
    """
    cloned = clone_public_process(
        db=db,
        public_process_id=process_id,
        new_owner_email=owner_email,
        active_only=payload.active_only,
    )
    if cloned is None:
        raise HTTPException(
            status_code=404,
            detail=f"Public process with id {process_id} not found.",
        )

    if not cloned.versions:
        db.delete(cloned)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="No active version found to clone. The process has no active version.",
        )

    version_items = [
        CatalogVersion(
            id=v.id,
            process_id=v.process_id,
            version_number=v.version_number,
            version_name=v.version_name or "",
            version_description=v.version_description,
            created_at=v.created_at,
            llm_model=v.llm_model,
            tokens_used=v.tokens_used,
            status=v.status,
            plantuml_code=v.plantuml_code,
            image_path=v.image_path,
            prompt=v.prompt,
            canvas_state=v.canvas_state,
        )
        for v in cloned.versions
    ]

    return CatalogProcessDetail(
        process_id=cloned.id,
        process_name=cloned.name,
        domain=cloned.domain,
        description=cloned.description,
        versions=version_items,
    )


@router.delete(
    "/catalog/public/{process_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
    },
    summary="Delete a public process (owner only)",
    tags=["catalog-public"],
)
async def delete_public_process_endpoint(
    process_id: int,
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> Response:
    """
    Delete a public process and all its versions.
    Only the user who made the process public can delete it.
    Returns 404 if the process does not exist or requester is not the owner.
    """
    deleted = delete_public_process(
        db=db,
        public_process_id=process_id,
        requester_email=owner_email,
    )
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Public process with id {process_id} not found or you are not the owner.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    version_name: str = Query("", description="Optional human-friendly name of this version"),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> CatalogVersion:
    """
    Create a new draft version for an existing process using already generated PlantUML.
    Does NOT call the LLM.
    """
    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must not be empty.")

    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must contain @startuml and @enduml.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"PlantUML validation failed before save: {error_msg}")

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render PlantUML diagram: {exc}") from exc

    try:
        version = create_new_version_for_process(
            db=db,
            process_id=process_id,
            plantuml_code=plantuml_code,
            owner_email=owner_email,
            prompt_dict=payload.prompt or {},
            llm_model=settings.llm.model,
            tokens_used=None,
            version_name=version_name,
            version_description=payload.version_description,
            image_path=image_path,
            canvas_state=payload.canvas_state,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save new version: {exc}") from exc

    return CatalogVersion(
        id=version.id,
        process_id=version.process_id,
        version_number=version.version_number,
        version_name=version.version_name or "",
        version_description=version.version_description,
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
        image_path=version.image_path,
        prompt=version.prompt,
        canvas_state=version.canvas_state,
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
    version_name: str = Query("", description="Optional name of this version"),
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> CatalogVersion:
    """
    Update an existing draft version using already generated (and inspected) PlantUML.
    Does NOT call the LLM.
    """
    plantuml_code = (payload.plantuml_code or "").strip()
    if not plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must not be empty.")

    if "@startuml" not in plantuml_code or "@enduml" not in plantuml_code:
        raise HTTPException(status_code=400, detail="plantuml_code must contain @startuml and @enduml.")

    is_valid, error_msg = validate_plantuml(plantuml_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"PlantUML validation failed before save: {error_msg}")

    try:
        image_path = render_plantuml_to_png(plantuml_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render PlantUML diagram: {exc}") from exc

    try:
        updated = update_draft_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
            plantuml_code=plantuml_code,
            owner_email=owner_email,
            prompt_dict=payload.prompt or {},
            version_name=version_name,
            version_description=payload.version_description,
            image_path=image_path,
            canvas_state=payload.canvas_state,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update draft version: {exc}") from exc

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
        version_description=updated.version_description,
        created_at=updated.created_at,
        llm_model=updated.llm_model,
        tokens_used=updated.tokens_used,
        status=updated.status,
        plantuml_code=updated.plantuml_code,
        image_path=updated.image_path,
        prompt=updated.prompt,
        canvas_state=updated.canvas_state,
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
    owner_email: str = Depends(get_current_user),
) -> Response:
    """
    Delete a local process from the catalog, including all its stored versions.
    Only the owner of the process can delete it.
    """
    deleted = delete_process_with_versions(db, process_id, owner_email=owner_email)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Process with id {process_id} not found.")
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
    owner_email: str = Depends(get_current_user),
) -> Response:
    """
    Delete a single version identified by (process_id, version_number).
    Verifies process ownership before deleting.
    """
    deleted = delete_version_for_process(
        db=db,
        process_id=process_id,
        version_number=version_number,
        owner_email=owner_email,
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
    summary="Delete ALL local processes and their versions for the authenticated user",
    tags=["catalog"],
)
async def clear_catalog(
    db: Session = Depends(get_db),
    owner_email: str = Depends(get_current_user),
) -> Response:
    """
    Hard-delete all LOCAL processes and all their versions belonging to the
    authenticated user. Does NOT affect other users' data or public processes.
    """
    try:
        process_ids = [
            row.id
            for row in db.query(Process.id)
            .filter(Process.owner_email == owner_email, Process.access == "local")
            .all()
        ]

        if process_ids:
            db.query(Version).filter(
                Version.process_id.in_(process_ids)
            ).delete(synchronize_session=False)
            db.query(Process).filter(
                Process.id.in_(process_ids)
            ).delete(synchronize_session=False)
            db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear catalog: {exc}") from exc

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
    owner_email: str = Depends(get_current_user),
) -> CatalogVersion:
    """
    Publish a specific version of a process (sets status to 'active',
    archives all other versions of that process).
    Verifies that the process belongs to the authenticated user.
    """
    try:
        version = publish_version(
            db=db,
            process_id=process_id,
            version_number=version_number,
            owner_email=owner_email,
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
        version_description=version.version_description,
        created_at=version.created_at,
        llm_model=version.llm_model,
        tokens_used=version.tokens_used,
        status=version.status,
        plantuml_code=version.plantuml_code,
        image_path=version.image_path,
        prompt=version.prompt,
        canvas_state=version.canvas_state,
    )