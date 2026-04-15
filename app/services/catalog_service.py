# app/services/catalog_service.py
from typing import Dict, Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.schemas import ProcessInCatalog
from app.database.models import Process, Version


def create_process(
    db: Session,
    name: str,
    domain: str | None = None,
    description: str | None = None,
    owner_email: str | None = None,
) -> Process:
    """
    Always create a brand-new Process record.

    Process identity is determined solely by the auto-incremented primary key.
    Two processes may share the same name — that is intentional and expected.
    """
    process = Process(
        name=name,
        domain=domain,
        description=description,
        owner_email=owner_email,
    )
    db.add(process)
    db.flush()
    return process


def save_process_version(
    db: Session,
    process_name: str,
    domain: str | None,
    prompt_dict: dict,
    plantuml_code: str,
    llm_model: str,
    tokens_used: int | None = None,
    version_name: str | None = None,
    owner_email: str | None = None,
    image_path: str | None = None,
    canvas_state: Dict[str, Any] | None = None,
    process_description: str | None = None,
    version_description: str | None = None,
) -> Version:
    """
    Always create a new Process and save its first Version (v1).

    This function is called exclusively from the /catalog/save endpoint,
    which always represents the user saving a brand-new process for the
    first time. Adding a version to an existing process is handled
    separately by create_new_version_for_process().
    """
    # 1) Always create a new process — never reuse an existing one by name
    process = create_process(
        db=db,
        name=process_name,
        domain=domain,
        description=process_description,
        owner_email=owner_email,
    )

    # 2) First version of a new process is always v1
    new_number = 1
    if not version_name:
        version_name = f"v{new_number}"

    # 3) Create and persist Version
    version = Version(
        process_id=process.id,
        version_number=new_number,
        version_name=version_name,
        owner_email=owner_email,
        plantuml_code=plantuml_code,
        prompt=prompt_dict,
        llm_model=llm_model,
        tokens_used=tokens_used,
        status="draft",
        image_path=image_path,
        canvas_state=canvas_state,
        version_description=version_description,
    )

    db.add(version)
    db.commit()
    db.refresh(version)

    return version


def get_all_processes(
    db: Session,
    owner_email: str,
    name: str | None = None,
    domain: str | None = None,
) -> list[ProcessInCatalog]:
    """
    List processes for a specific user (owner_email) with optional
    filtering by name/domain and aggregated versions_count.
    """
    query = (
        db.query(
            Process.id,
            Process.name,
            Process.domain,
            func.count(Version.id).label("versions_count"),
        )
        .outerjoin(Version, Version.process_id == Process.id)
        .group_by(Process.id, Process.name, Process.domain)
        .filter(Process.owner_email == owner_email)
    )

    if name:
        query = query.filter(Process.name.ilike(f"%{name}%"))
    if domain:
        query = query.filter(Process.domain.ilike(f"%{domain}%"))

    rows = query.all()

    return [
        ProcessInCatalog(
            id=row.id,
            name=row.name,
            domain=row.domain,
            versions_count=row.versions_count,
        )
        for row in rows
    ]


def delete_process_with_versions(
    db: Session,
    process_id: int,
    owner_email: str,
) -> bool:
    """
    Delete a process and all its versions.

    Returns True if something was deleted, False if process does not exist
    or does not belong to owner_email.
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.owner_email == owner_email)
        .first()
    )
    if process is None:
        return False

    db.delete(process)
    db.commit()

    return True


def create_new_version_for_process(
    db: Session,
    process_id: int,
    plantuml_code: str,
    owner_email: str,
    prompt_dict: dict | None,
    llm_model: str | None,
    tokens_used: int | None = None,
    version_name: str = "",
    image_path: str | None = None,
    canvas_state: Dict[str, Any] | None = None,
    version_description: str | None = None,
) -> Version:
    """
    Create a new Version row for an existing process identified by process_id.

    Verifies that the process belongs to owner_email before proceeding.
    version_number is auto-incremented (max + 1).
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.owner_email == owner_email)
        .first()
    )
    if process is None:
        raise ValueError(f"Process with id {process_id} not found")

    last_version = (
        db.query(Version)
        .filter(Version.process_id == process_id)
        .order_by(Version.version_number.desc())
        .first()
    )

    next_version_number = (
        1 if last_version is None else last_version.version_number + 1
    )

    if not version_name:
        version_name = f"v{next_version_number}"

    new_version = Version(
        process_id=process_id,
        version_number=next_version_number,
        version_name=version_name,
        owner_email=owner_email,
        plantuml_code=plantuml_code,
        prompt=prompt_dict or {},
        llm_model=llm_model or "",
        tokens_used=tokens_used,
        status="draft",
        image_path=image_path,
        canvas_state=canvas_state,
        version_description=version_description,
    )

    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    return new_version


def delete_version_for_process(
    db: Session,
    process_id: int,
    version_number: int,
    owner_email: str,
) -> bool:
    """
    Delete a single version identified by (process_id, version_number).

    Verifies process ownership before deleting.
    Returns True if the version was found and deleted, False otherwise.
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.owner_email == owner_email)
        .first()
    )
    if process is None:
        return False

    version = (
        db.query(Version)
        .filter(
            Version.process_id == process_id,
            Version.version_number == version_number,
        )
        .first()
    )

    if version is None:
        return False

    db.delete(version)
    db.commit()

    return True


def publish_version(
    db: Session,
    process_id: int,
    version_number: int,
    owner_email: str,
) -> Version | None:
    """
    Set given version (process_id, version_number) as ACTIVE and
    archive all other versions of that process.

    Verifies process ownership before publishing.
    - No version -> None
    - If already ACTIVE -> ValueError
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.owner_email == owner_email)
        .first()
    )
    if process is None:
        return None

    version = (
        db.query(Version)
        .filter(
            Version.process_id == process_id,
            Version.version_number == version_number,
        )
        .first()
    )

    if version is None:
        return None

    if version.status == "active":
        raise ValueError("Version is already active and cannot be re-published.")

    # Archive all other versions of the same process
    db.query(Version).filter(
        Version.process_id == process_id,
        Version.version_number != version_number,
    ).update({"status": "archived"}, synchronize_session=False)

    # Set selected version to active
    version.status = "active"
    db.commit()
    db.refresh(version)

    return version


def update_draft_version(
    db: Session,
    process_id: int,
    version_number: int,
    plantuml_code: str,
    owner_email: str,
    prompt_dict: dict | None,
    version_name: str = "",
    image_path: str | None = None,
    canvas_state: Dict[str, Any] | None = None,
    version_description: str | None = None,
) -> Version | None:
    """
    Update PlantUML (and optional prompt + version_name + image_path + canvas_state
    + version_description) for a version in 'draft' status.

    Verifies process ownership before updating.
    - No version -> returns None.
    - Status != 'draft' -> raises ValueError.
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.owner_email == owner_email)
        .first()
    )
    if process is None:
        return None

    version = (
        db.query(Version)
        .filter(
            Version.process_id == process_id,
            Version.version_number == version_number,
        )
        .first()
    )

    if version is None:
        return None

    if version.status != "draft":
        raise ValueError("Only draft versions can be modified.")

    version.plantuml_code = plantuml_code
    version.prompt = prompt_dict or {}
    version.version_name = version_name
    version.image_path = image_path
    version.canvas_state = canvas_state
    if version_description is not None:
        version.version_description = version_description

    db.commit()
    db.refresh(version)

    return version