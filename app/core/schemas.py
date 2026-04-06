from typing import List, Optional
from datetime import datetime

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
    ConfigDict,
)


class Action(BaseModel):
    """
    Single action in the process.
    """

    actor: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Who performs the action",
    )

    action: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Description of the action",
    )

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
    can (optionally) reference concrete actions in the `actions` list
    via zero-based indices. This allows the visual editor and PlantUML
    generator to draw explicit branching edges to the correct action nodes.
    """

    condition: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Decision condition",
    )

    branch_yes: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Text description of the YES branch outcome",
    )

    branch_no: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Text description of the NO branch outcome",
    )

    yes_action_index: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Zero-based index into ProcessStructureInput.actions that "
            "represents the target action for the YES branch. "
            "Optional for backward compatibility, but strongly recommended."
        ),
    )

    no_action_index: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Zero-based index into ProcessStructureInput.actions that "
            "represents the target action for the NO branch. "
            "Optional for backward compatibility, but strongly recommended."
        ),
    )

    @field_validator("condition", "branch_yes", "branch_no")
    @classmethod
    def no_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()


class ParallelBlock(BaseModel):
    """
    Actions that are executed in parallel (fork/join).
    """

    actions: List[Action] = Field(
        ...,
        min_length=2,
        max_length=5,
        description="Actions that run in parallel within this block.",
    )


class ProcessStructureInput(BaseModel):
    """
    Structure of the process used for generation.

    Does NOT contain process_name/domain – these come from query parameters.
    """

    actors: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of actors (swimlanes)",
        examples=[["Customer", "System", "Warehouse"]],
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
        - every action references an actor that exists in the `actors` list
        - invalid decision indices are sanitized to None instead of failing
        """
        actor_set = {a.strip() for a in self.actors}
        unknown_actors = sorted(
            {action.actor for action in self.actions if action.actor not in actor_set}
        )

        if unknown_actors:
            raise ValueError(
                f"Actions reference unknown actors: {', '.join(unknown_actors)}"
            )

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


class GenerateResponse(BaseModel):
    """
    Response model for the /generate endpoint.
    """

    status: str = Field(default="success")
    plantuml_code: str = Field(..., description="Generated PlantUML code")
    process_name: str
    tokens_used: Optional[int] = None
    model_used: str
    prompt: dict | None = None


class ErrorResponse(BaseModel):
    """
    Error response model.
    """

    status: str = Field(default="error")
    error: str
    details: Optional[str] = None


class CatalogVersion(BaseModel):
    id: int
    process_id: int
    version_number: int
    version_name: str = ""
    created_at: datetime
    llm_model: str
    tokens_used: Optional[int] = None
    status: str
    plantuml_code: str
    image_path: Optional[str] = None
    prompt: dict | None = None   # ← PRIDAJ TENTO RIADOK


class CatalogProcessDetail(BaseModel):
    process_id: int
    process_name: str
    domain: Optional[str] = None
    versions: List[CatalogVersion]


class ProcessInCatalog(BaseModel):
    id: int
    name: str
    domain: str | None = None
    versions_count: int


model_config = ConfigDict(from_attributes=True)


class NewVersionInput(BaseModel):
    plantuml_code: str
    prompt: dict | None = None