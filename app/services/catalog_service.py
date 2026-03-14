# app/services/catalog_service.py
from typing import Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.schemas import ProcessInCatalog
from app.database.models import Process, Version


def get_or_create_process(
    db: Session,
    name: str,
    domain: str | None = None,
) -> Process:
    """
    Find existing Process by (name, domain) or create a new one.

    This helper is useful for generation endpoints, where we want
    to reuse a process if it already exists in the catalog.
    """
    process = (
        db.query(Process)
        .filter(Process.name == name, Process.domain == domain)
        .first()
    )

    if process is None:
        process = Process(name=name, domain=domain)
        db.add(process)
        db.flush()  # ensure process.id is available

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
    image_path: str | None = None,
) -> Version:
    """
    Find or create Process by (name, domain) and save a new Version.

    If version_name is not provided, it is generated automatically
    as 'vX' where X is the new version_number.
    """
    # 1) find or create process
    process = get_or_create_process(db=db, name=process_name, domain=domain)

    # 2) find latest version_number for this process
    latest_number = (
        db.query(func.max(Version.version_number))
        .filter(Version.process_id == process.id)
        .scalar()
        or 0
    )

    new_number = latest_number + 1

    # 3) generate default version_name if not provided
    if not version_name:
        version_name = f"v{new_number}"

    # 4) create and persist Version
    version = Version(
        process_id=process.id,
        version_number=new_number,
        version_name=version_name,
        plantuml_code=plantuml_code,
        prompt=prompt_dict,
        llm_model=llm_model,
        tokens_used=tokens_used,
        status="draft",
        image_path=image_path,
    )

    db.add(version)
    db.commit()
    db.refresh(version)

    return version


def get_all_processes(
    db: Session,
    name: str | None = None,
    domain: str | None = None,
) -> list[ProcessInCatalog]:
    """
    List processes with optional filtering by name/domain and
    aggregated versions_count.
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


def delete_process_with_versions(db: Session, process_id: int) -> bool:
    """
    Delete a process and all its versions.

    Returns True if something was deleted, False if process does not exist.
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        return False

    db.query(Version).filter(Version.process_id == process_id).delete()
    db.delete(process)
    db.commit()

    return True


def create_new_version_for_process(
    db: Session,
    process_id: int,
    plantuml_code: str,
    prompt_dict: dict | None,
    llm_model: str | None,
    tokens_used: int | None = None,
    version_name: str = "",
    image_path: str | None = None,
) -> Version:
    """
    Create a new Version row for an existing process.

    version_number is auto-incremented (max + 1).
    """
    process = db.query(Process).filter(Process.id == process_id).first()
    if process is None:
        raise ValueError(f"Process with id {process_id} not found")

    # find last version number for this process
    last_version = (
        db.query(Version)
        .filter(Version.process_id == process_id)
        .order_by(Version.version_number.desc())
        .first()
    )

    next_version_number = 1 if last_version is None else last_version.version_number + 1

    new_version = Version(
        process_id=process_id,
        version_number=next_version_number,
        version_name=version_name,
        plantuml_code=plantuml_code,
        prompt=prompt_dict or {},
        llm_model=llm_model or "",
        tokens_used=tokens_used,
        status="draft",
        image_path=image_path,
    )

    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    return new_version


def delete_version_for_process(
    db: Session,
    process_id: int,
    version_number: int,
) -> bool:
    """
    Delete a single version identified by (process_id, version_number).

    Returns True if the version was found and deleted, False otherwise.
    """
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
) -> Version | None:
    """
    Set given version (process_id, version_number) as ACTIVE and
    archive all other versions of that process.

    - No version -> None
    - If already ACTIVE -> ValueError
    """
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

    # archive all other versions of the same process
    db.query(Version).filter(
        Version.process_id == process_id,
        Version.version_number != version_number,
    ).update({"status": "archived"}, synchronize_session=False)

    # set selected version to active
    version.status = "active"
    db.commit()
    db.refresh(version)

    return version


def update_draft_version(
    db: Session,
    process_id: int,
    version_number: int,
    plantuml_code: str,
    prompt_dict: dict | None,
    version_name: str = "",
    image_path: str | None = None,
) -> Version | None:
    """
    Update PlantUML (and optional prompt + version_name + image_path) for a version in 'draft'.

    - No version -> returns None.
    - Status != 'draft' -> raises ValueError.
    """
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

    db.commit()
    db.refresh(version)

    return version
