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
    processes = db.query(Process).all()
    return [
        ProcessInCatalog(
            id=p.id,
            name=p.name,
            domain=p.domain,
        )
        for p in processes
    ]