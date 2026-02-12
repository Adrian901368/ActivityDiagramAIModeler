from typing import Dict, Optional, List

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.schemas import ProcessInCatalog
from app.database.models import Process, Version


def save_process_version(
    db: Session,
    process_name: str,
    domain: Optional[str],
    prompt_dict: Dict,
    plantuml_code: str,
    llm_model: str,
    tokens_used: Optional[int] = None,
) -> Version:
    stmt = select(Process).where(Process.name == process_name)
    process = db.execute(stmt).scalar_one_or_none()

    if process is None:
        process = Process(name=process_name, domain=domain)
        db.add(process)
        db.flush()

    stmt_ver = (
        select(func.coalesce(func.max(Version.version_number), 0))
        .where(Version.process_id == process.id)
    )
    last_version = db.execute(stmt_ver).scalar_one()
    next_version = last_version + 1

    version = Version(
        process_id=process.id,
        version_number=next_version,
        plantuml_code=plantuml_code,
        prompt=prompt_dict,
        llm_model=llm_model,
        tokens_used=tokens_used,
        status="draft",
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return version

def get_all_processes(db: Session) -> List[ProcessInCatalog]:
    rows = (
        db.query(
            Process.id,
            Process.name,
            Process.domain,
            func.count(Version.id).label("versions_count"),
        )
        .outerjoin(Version, Version.process_id == Process.id)
        .group_by(Process.id, Process.name, Process.domain)
        .all()
    )

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
        prompt=prompt_dict,
        llm_model=llm_model,
        tokens_used=tokens_used,
        status="draft",  # alebo default podľa tvojho modelu
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

    - No version-> None
    - if ACTIVE -> ValueError
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

    (
        db.query(Version)
        .filter(Version.process_id == process_id)
        .filter(Version.version_number != version_number)
        .update({"status": "archived"}, synchronize_session=False)
    )

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
) -> Version | None:
    """
    Update PlantUML for version in 'draft'.

    - No version -> returns None.
    - No 'draft' -> throw ValueError.
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
    version.prompt = prompt_dict
    version.version_name = version_name

    db.commit()
    db.refresh(version)
    return version