# app/services/catalog_service.py

from typing import Dict, Any, Optional, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.schemas import (
    ProcessInCatalog,
    PublicCatalogListItem,
    PublicCatalogVersion,
    PublicCatalogProcess,
)
from app.database.models import Process, Version


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _version_to_public_schema(v: Version) -> PublicCatalogVersion:
    """Convert a Version ORM row to PublicCatalogVersion schema."""
    return PublicCatalogVersion(
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


def _is_local(process_access_col):
    """
    SQLAlchemy filter clause that matches 'local' OR NULL.
    Existing rows created before the access column was added have access=NULL
    and must be treated as local.
    """
    return or_(process_access_col == "local", process_access_col.is_(None))


# ---------------------------------------------------------------------------
# Process creation
# ---------------------------------------------------------------------------

def create_process(
    db: Session,
    name: str,
    domain: Optional[str] = None,
    description: Optional[str] = None,
    owner_email: Optional[str] = None,
    access: str = "local",
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
        access=access,
    )
    db.add(process)
    db.flush()
    return process


# ---------------------------------------------------------------------------
# Save first version (creates new process + first version atomically)
# ---------------------------------------------------------------------------

def save_process_version(
    db: Session,
    process_name: str,
    domain: Optional[str],
    prompt_dict: dict,
    plantuml_code: str,
    llm_model: str,
    tokens_used: Optional[int] = None,
    version_name: Optional[str] = None,
    owner_email: Optional[str] = None,
    image_path: Optional[str] = None,
    canvas_state: Optional[Dict[str, Any]] = None,
    process_description: Optional[str] = None,
    version_description: Optional[str] = None,
) -> Version:
    """
    Always create a new Process and save its first Version (v1).

    This function is called exclusively from the /catalog/save endpoint,
    which always represents the user saving a brand-new process for the
    first time. Adding a version to an existing process is handled
    separately by create_new_version_for_process.
    """
    # 1 — Always create a new process, never reuse an existing one by name.
    process = create_process(
        db=db,
        name=process_name,
        domain=domain,
        description=process_description,
        owner_email=owner_email,
        access="local",
    )

    # 2 — First version of a new process is always v1.
    new_number = 1
    if not version_name:
        version_name = f"v{new_number}"

    # 3 — Create and persist Version.
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


# ---------------------------------------------------------------------------
# Local catalog queries
# ---------------------------------------------------------------------------

def get_all_processes(
    db: Session,
    owner_email: str,
    name: Optional[str] = None,
    domain: Optional[str] = None,
) -> List[ProcessInCatalog]:
    """
    List LOCAL processes for a specific user (owner_email) with optional
    filtering by name/domain and aggregated versions_count.
    Treats access=NULL as 'local' for rows created before the column existed.
    """
    query = (
        db.query(
            Process.id,
            Process.name,
            Process.domain,
            Process.description,
            func.count(Version.id).label("versions_count"),
        )
        .outerjoin(Version, Version.process_id == Process.id)
        .group_by(Process.id, Process.name, Process.domain, Process.description)
        .filter(
            Process.owner_email == owner_email,
            _is_local(Process.access),  # FIX: NULL-safe local check
        )
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
            description=row.description,
            versions_count=row.versions_count,
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Version mutations on existing processes
# ---------------------------------------------------------------------------

def create_new_version_for_process(
    db: Session,
    process_id: int,
    plantuml_code: str,
    owner_email: str,
    prompt_dict: Optional[dict] = None,
    llm_model: Optional[str] = None,
    tokens_used: Optional[int] = None,
    version_name: str = "",
    image_path: Optional[str] = None,
    canvas_state: Optional[Dict[str, Any]] = None,
    version_description: Optional[str] = None,
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
    next_version_number = 1 if last_version is None else last_version.version_number + 1

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


def update_draft_version(
    db: Session,
    process_id: int,
    version_number: int,
    plantuml_code: str,
    owner_email: str,
    prompt_dict: Optional[dict] = None,
    version_name: str = "",
    image_path: Optional[str] = None,
    canvas_state: Optional[Dict[str, Any]] = None,
    version_description: Optional[str] = None,
) -> Optional[Version]:
    """
    Update PlantUML and optional fields for a version in draft status.
    Verifies process ownership before updating.
    Returns None if version not found, raises ValueError if not a draft.
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


def publish_version(
    db: Session,
    process_id: int,
    version_number: int,
    owner_email: str,
) -> Optional[Version]:
    """
    Set given version (process_id, version_number) as ACTIVE and archive
    all other versions of that process.
    Verifies process ownership before publishing.
    Returns None if not found, raises ValueError if already active.
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

    # Archive all other versions of the same process.
    db.query(Version).filter(
        Version.process_id == process_id,
        Version.version_number != version_number,
    ).update({"status": "archived"}, synchronize_session=False)

    # Set selected version to active.
    version.status = "active"
    db.commit()
    db.refresh(version)
    return version


# ---------------------------------------------------------------------------
# Delete operations
# ---------------------------------------------------------------------------

def delete_process_with_versions(
    db: Session,
    process_id: int,
    owner_email: str,
) -> bool:
    """
    Delete a process and all its versions.
    Returns True if deleted, False if process does not exist or not owned by user.
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


def delete_version_for_process(
    db: Session,
    process_id: int,
    version_number: int,
    owner_email: str,
) -> bool:
    """
    Delete a single version identified by (process_id, version_number).
    Verifies process ownership before deleting.
    Returns True if deleted, False otherwise.
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


# ---------------------------------------------------------------------------
# Public catalog — read
# ---------------------------------------------------------------------------

def get_public_processes(
    db: Session,
    name: Optional[str] = None,
    owner: Optional[str] = None,
) -> List[PublicCatalogListItem]:
    """
    Return a lightweight list of all public processes with versions_count.
    Supports optional substring filtering by name and owner_email.
    """
    query = (
        db.query(
            Process.id,
            Process.name,
            Process.domain,
            Process.description,
            Process.owner_email,
            func.count(Version.id).label("versions_count"),
        )
        .outerjoin(Version, Version.process_id == Process.id)
        .group_by(
            Process.id,
            Process.name,
            Process.domain,
            Process.description,
            Process.owner_email,
        )
        .filter(Process.access == "public")
    )

    if name:
        query = query.filter(Process.name.ilike(f"%{name}%"))
    if owner:
        query = query.filter(Process.owner_email.ilike(f"%{owner}%"))

    rows = query.order_by(Process.id.desc()).all()
    return [
        PublicCatalogListItem(
            id=row.id,
            name=row.name,
            domain=row.domain,
            description=row.description,
            owner_email=row.owner_email,
            versions_count=row.versions_count,
        )
        for row in rows
    ]


def get_public_process_detail(
    db: Session,
    process_id: int,
) -> Optional[PublicCatalogProcess]:
    """
    Return full detail for a single public process including all its versions.
    Returns None if the process does not exist or is not public.
    """
    process = (
        db.query(Process)
        .filter(Process.id == process_id, Process.access == "public")
        .first()
    )
    if process is None:
        return None

    versions = (
        db.query(Version)
        .filter(Version.process_id == process_id)
        .order_by(Version.version_number.desc())
        .all()
    )

    return PublicCatalogProcess(
        id=process.id,
        name=process.name,
        domain=process.domain,
        description=process.description,
        owner_email=process.owner_email,
        versions=[_version_to_public_schema(v) for v in versions],
    )


# ---------------------------------------------------------------------------
# Public catalog — write (make public, clone, delete)
# ---------------------------------------------------------------------------

def make_process_public(
    db: Session,
    process_id: int,
    owner_email: str,
    mode: str = "active_only",
) -> Optional[Process]:
    """
    Create a public copy of a local process owned by owner_email.

    mode='active_only'  -> copies only versions with status='active'
    mode='all_versions' -> copies versions with status IN ('active', 'archived')
    Draft versions are NEVER included regardless of mode.

    Treats access=NULL as 'local' for rows created before the column existed.
    Returns the newly created public Process ORM object (with versions loaded),
    or None if the source local process does not exist / is not owned by user.
    """
    source = (
        db.query(Process)
        .filter(
            Process.id == process_id,
            Process.owner_email == owner_email,
            _is_local(Process.access),  # FIX: NULL-safe local check
        )
        .first()
    )
    if source is None:
        return None

    # Determine which versions to copy.
    if mode == "all_versions":
        allowed_statuses = ("active", "archived")
    else:
        allowed_statuses = ("active",)

    source_versions = (
        db.query(Version)
        .filter(
            Version.process_id == source.id,
            Version.status.in_(allowed_statuses),
        )
        .order_by(Version.version_number.asc())
        .all()
    )

    # Create a new public Process record.
    public_process = Process(
        name=source.name,
        domain=source.domain,
        description=source.description,
        owner_email=owner_email,
        access="public",
    )
    db.add(public_process)
    db.flush()

    # Copy qualifying versions with new ids and reset version_number sequence.
    for idx, sv in enumerate(source_versions, start=1):
        new_version = Version(
            process_id=public_process.id,
            version_number=idx,
            version_name=sv.version_name or f"v{idx}",
            version_description=sv.version_description,
            owner_email=sv.owner_email,
            plantuml_code=sv.plantuml_code,
            prompt=sv.prompt,
            llm_model=sv.llm_model,
            tokens_used=sv.tokens_used,
            status=sv.status,
            created_at=sv.created_at,
            image_path=sv.image_path,
            canvas_state=sv.canvas_state,
        )
        db.add(new_version)

    db.commit()
    db.refresh(public_process)
    return public_process


def clone_public_process(
    db: Session,
    public_process_id: int,
    new_owner_email: str,
) -> Optional[Process]:
    """
    Clone a public process into the local catalog of new_owner_email.

    Creates a new local Process with new ids and copies all non-draft
    versions. The cloned process is fully editable by the new owner.
    Returns None if the public process does not exist.
    """
    source = (
        db.query(Process)
        .filter(Process.id == public_process_id, Process.access == "public")
        .first()
    )
    if source is None:
        return None

    source_versions = (
        db.query(Version)
        .filter(Version.process_id == source.id)
        .order_by(Version.version_number.asc())
        .all()
    )

    # Create a new local Process for the new owner.
    cloned_process = Process(
        name=source.name,
        domain=source.domain,
        description=source.description,
        owner_email=new_owner_email,
        access="local",
    )
    db.add(cloned_process)
    db.flush()

    # Copy all versions with new ids and reset version_number sequence.
    for idx, sv in enumerate(source_versions, start=1):
        new_version = Version(
            process_id=cloned_process.id,
            version_number=idx,
            version_name=sv.version_name or f"v{idx}",
            version_description=sv.version_description,
            owner_email=new_owner_email,
            plantuml_code=sv.plantuml_code,
            prompt=sv.prompt,
            llm_model=sv.llm_model,
            tokens_used=sv.tokens_used,
            # Cloned versions start as draft so the new owner can edit freely.
            status="draft",
            image_path=sv.image_path,
            canvas_state=sv.canvas_state,
        )
        db.add(new_version)

    db.commit()
    db.refresh(cloned_process)
    return cloned_process


def delete_public_process(
    db: Session,
    public_process_id: int,
    requester_email: str,
) -> bool:
    """
    Delete a public process and all its versions.
    Only the original owner (owner_email) can delete it.
    Returns True if deleted, False if not found or requester is not the owner.
    """
    process = (
        db.query(Process)
        .filter(
            Process.id == public_process_id,
            Process.access == "public",
            Process.owner_email == requester_email,
        )
        .first()
    )
    if process is None:
        return False

    db.delete(process)
    db.commit()
    return True