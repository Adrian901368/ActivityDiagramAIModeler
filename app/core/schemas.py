from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class Action(BaseModel):
    """
    Single action in the process.
    """
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
    """
    condition: str = Field(..., min_length=1, max_length=200, description="Decision condition")
    branch_yes: str = Field(..., min_length=1, max_length=200, description="Action for YES branch")
    branch_no: str = Field(..., min_length=1, max_length=200, description="Action for NO branch")

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
    actions: List[Action] = Field(..., min_items=2, max_items=5)


class ProcessInput(BaseModel):
    """
    High-level input model used in tests.

    Contains process_name/domain together with actors, actions and decisions.
    """
    process_name: str = Field(..., min_length=1, max_length=255, description="Name of the process")
    domain: Optional[str] = Field(default=None, description="Domain/category of the process")

    actors: List[str] = Field(
        ...,
        min_items=1,
        max_items=10,
        description="List of actors (swimlanes)",
        examples=[["Customer", "System", "Warehouse"]],
    )
    actions: List[Action] = Field(
        ...,
        min_items=1,
        max_items=50,
        description="Sequence of actions in the process",
    )
    decisions: Optional[List[Decision]] = Field(
        default=None,
        max_items=10,
        description="Decisions in the process (optional)",
    )

    @field_validator("process_name")
    @classmethod
    def validate_process_name(cls, v: str) -> str:
        """
        Ensure process_name is not empty or whitespace.

        Error message text is important for existing tests.
        """
        if not v or not v.strip():
            raise ValueError("Process name must not be empty")
        return v.strip()

    @field_validator("actors")
    @classmethod
    def validate_actors(cls, v: List[str]) -> List[str]:
        """
        Ensure there is at least one actor and no duplicates.
        """
        cleaned = [a.strip() for a in v if a and a.strip()]
        if len(cleaned) != len(set(cleaned)):
            # Text used in test_schemas.py
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


class ProcessStructureInput(BaseModel):
    """
    Structure of the process used for generation.

    Does NOT contain process_name/domain – they come from query parameters.
    """
    actors: List[str] = Field(
        ...,
        min_items=1,
        max_items=10,
        description="List of actors (swimlanes)",
        examples=[["Customer", "System", "Warehouse"]],
    )
    actions: List[Action] = Field(
        ...,
        min_items=1,
        max_items=50,
        description="Sequence of actions in the process",
    )
    decisions: Optional[List[Decision]] = Field(
        default=None,
        max_items=10,
        description="Decisions in the process (optional)",
    )
    parallel_blocks: Optional[List[ParallelBlock]] = Field(
        default=None,
        max_items=5,
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


class GenerateResponse(BaseModel):
    """
    Response model for the /generate endpoint.
    """
    status: str = Field(default="success")
    plantuml_code: str = Field(..., description="Generated PlantUML code")
    process_name: str
    tokens_used: Optional[int] = None
    model_used: str


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

    class Config:
        from_attributes = True


class NewVersionInput(BaseModel):
    plantuml_code: str
    prompt: dict | None = None
