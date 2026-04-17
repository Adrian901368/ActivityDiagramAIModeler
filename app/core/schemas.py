# app/core/schemas.py

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


# ---------------------------------------------------------------------------
# Process structure input models
# ---------------------------------------------------------------------------

class Action(BaseModel):
    """Single action in the process."""

    actor: str = Field(..., min_length=1, max_length=100, description="Who performs the action")
    action: str = Field(..., min_length=1, max_length=500, description="Description of the action")

    @field_validator("actor", "action")
    @classmethod
    def no_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()


class Decision(BaseModel):
    """
    Decision (if-then-else) in the process.

    In addition to the textual description of YES/NO branches, this model
    can optionally reference concrete actions in the actions list via
    zero-based indices. This allows the visual editor and PlantUML generator
    to draw explicit branching edges to the correct action nodes.
    """

    condition: str = Field(..., min_length=1, max_length=200, description="Decision condition")
    branch_yes: str = Field(..., min_length=1, max_length=200, description="Text description of the YES branch outcome")
    branch_no: str = Field(..., min_length=1, max_length=200, description="Text description of the NO branch outcome")

    yes_action_index: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Zero-based index into ProcessStructureInput.actions that represents "
            "the target action for the YES branch. Optional for backward compatibility, "
            "but strongly recommended."
        ),
    )
    no_action_index: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Zero-based index into ProcessStructureInput.actions that represents "
            "the target action for the NO branch. Optional for backward compatibility, "
            "but strongly recommended."
        ),
    )

    @field_validator("condition", "branch_yes", "branch_no")
    @classmethod
    def no_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()


class ParallelBlock(BaseModel):
    """Actions that are executed in parallel (fork/join)."""

    actions: List[Action] = Field(
        ...,
        min_length=2,
        max_length=5,
        description="Actions that run in parallel within this block.",
    )


class ProcessStructureInput(BaseModel):
    """
    Structure of the process used for generation.
    Does NOT contain process_name/domain — these come from query parameters.
    """

    actors: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of actors (swimlanes)",
        examples=["Customer", "System", "Warehouse"],
    )
    actions: List[Action] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Sequence of actions in the process",
    )
    decisions: Optional[List[Decision]] = Field(
        default=None,
        max_length=10,
        description="Decisions in the process (optional)",
    )
    parallel_blocks: Optional[List[ParallelBlock]] = Field(
        default=None,
        max_length=5,
        description="Parallel execution of actions (optional)",
    )

    @field_validator("actors")
    @classmethod
    def validate_actors(cls, v: List[str]) -> List[str]:
        cleaned = [a.strip() for a in v if a and a.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Actors must not contain duplicates")
        if not cleaned:
            raise ValueError("There must be at least one actor")
        return cleaned

    @field_validator("actions")
    @classmethod
    def validate_actions(cls, v: List[Action]) -> List[Action]:
        if not v:
            raise ValueError("There must be at least one action")
        return v

    @model_validator(mode="after")
    def validate_actor_references(self) -> "ProcessStructureInput":
        """
        Ensure that:
        - every action references an actor that exists in the actors list
        - invalid decision indices are sanitized to None instead of failing
        """
        actor_set = {a.strip() for a in self.actors}
        unknown_actors = sorted(
            action.actor for action in self.actions if action.actor not in actor_set
        )
        if unknown_actors:
            raise ValueError(f"Actions reference unknown actors: {', '.join(unknown_actors)}")

        if self.decisions:
            actions_len = len(self.actions)
            for dec in self.decisions:
                if dec.yes_action_index is not None:
                    if dec.yes_action_index < 0 or dec.yes_action_index >= actions_len:
                        dec.yes_action_index = None
                if dec.no_action_index is not None:
                    if dec.no_action_index < 0 or dec.no_action_index >= actions_len:
                        dec.no_action_index = None

        return self


class UpdateByPromptInput(BaseModel):
    """
    Payload for the POST /api/v1/update-structure endpoint.

    Carries the current canvas structure together with a free-text instruction
    that describes what the user wants to change in the diagram.
    The LLM receives both and returns a modified ProcessStructureInput.
    """

    update_instruction: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description=(
            "Free-text instruction describing the desired change, e.g. "
            "'Add a new step after X', 'Remove the decision about Y', "
            "'Rename actor Z to W'."
        ),
    )
    current_structure: ProcessStructureInput = Field(
        ...,
        description=(
            "The current canvas structure as returned by the frontend "
            "getStructure() call. This is sent as context to the LLM."
        ),
    )

    @field_validator("update_instruction")
    @classmethod
    def no_empty_instruction(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("update_instruction must not be empty")
        return v.strip()


# ---------------------------------------------------------------------------
# Generation response
# ---------------------------------------------------------------------------

class GenerateResponse(BaseModel):
    """Response model for the /generate endpoint."""

    status: str = Field(default="success")
    plantuml_code: str = Field(..., description="Generated PlantUML code")
    process_name: str
    tokens_used: Optional[int] = None
    model_used: str
    prompt: dict = None


class ErrorResponse(BaseModel):
    """Error response model."""

    status: str = Field(default="error")
    error: str
    details: Optional[str] = None


# ---------------------------------------------------------------------------
# Private catalog schemas
# ---------------------------------------------------------------------------

class CatalogVersion(BaseModel):
    """Single version of a process in the private catalog."""

    id: int
    process_id: int
    version_number: int
    version_name: str
    version_description: Optional[str] = None
    created_at: datetime
    llm_model: str
    tokens_used: Optional[int] = None
    status: str
    plantuml_code: str
    image_path: Optional[str] = None

    # Structured prompt stored with this version — returned to frontend for canvas restore.
    prompt: Optional[Dict[str, Any]] = None

    # Full canvas layout snapshot for pixel-perfect restore in catalog view.
    canvas_state: Optional[Dict[str, Any]] = None


class CatalogProcessDetail(BaseModel):
    """Full detail of a single private process including all versions."""

    process_id: int
    process_name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    versions: List[CatalogVersion]


class ProcessInCatalog(BaseModel):
    """Lightweight process entry for list views (no versions)."""

    id: int
    name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    versions_count: int

    model_config = ConfigDict(from_attributes=True)


class NewVersionInput(BaseModel):
    """Payload for saving or updating a version with pre-generated PlantUML."""

    plantuml_code: str

    # Structured prompt sent from the frontend on save.
    prompt: dict = None

    # Process-level description shown under the process name in the catalog detail view.
    version_description: Optional[str] = None

    # Full canvas layout snapshot sent from the frontend on save.
    canvas_state: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """Credentials submitted from the login form."""

    email: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User email address (one of the allowed STU test accounts)",
    )
    password: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Account password",
    )

    @field_validator("email", "password")
    @classmethod
    def no_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()


class LoginResponse(BaseModel):
    """Returned after a successful login."""

    success: bool = True
    email: str = Field(..., description="Authenticated user email")


# ---------------------------------------------------------------------------
# Public catalog schemas
# ---------------------------------------------------------------------------

class PublicCatalogVersion(BaseModel):
    """
    Single version of a process in the public catalog.
    Read-only — no tokens_used exposed, no process_id needed on the frontend.
    """

    id: int
    version_number: int
    version_name: str
    version_description: Optional[str] = None
    status: str
    created_at: datetime
    llm_model: str
    plantuml_code: str
    image_path: Optional[str] = None
    canvas_state: Optional[Dict[str, Any]] = None

    # Structured prompt — needed by frontend canvas editor for diagram restore.
    prompt: Optional[Dict[str, Any]] = None


class PublicCatalogProcess(BaseModel):
    """
    Full detail of a single public process including all its versions.
    Returned by GET /catalog/public/{process_id} and POST /catalog/{id}/make-public.
    """

    id: int
    name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    owner_email: str
    versions: List[PublicCatalogVersion]


class PublicCatalogListItem(BaseModel):
    """
    Lightweight public process entry for list views.
    Returned by GET /catalog/public (no versions, only versions_count).
    """

    id: int
    name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    owner_email: str
    versions_count: int

    model_config = ConfigDict(from_attributes=True)


class MakePublicRequest(BaseModel):
    """
    Payload for POST /catalog/{process_id}/make-public.

    mode='active_only'  -> copies only versions with status='active'
    mode='all_versions' -> copies versions with status IN ('active', 'archived')
    Draft versions are NEVER included regardless of mode.
    """

    mode: str = Field(
        default="active_only",
        description="Which versions to publish: 'active_only' or 'all_versions'",
    )

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        allowed = {"active_only", "all_versions"}
        if v not in allowed:
            raise ValueError(f"mode must be one of: {', '.join(sorted(allowed))}")
        return v