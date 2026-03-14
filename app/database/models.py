# app/database/models.py
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Process(Base):
    """
    Represents a single business process.

    Table `processes` (SQLite):

    - id INTEGER PRIMARY KEY
    - name VARCHAR(255) UNIQUE NOT NULL
    - domain VARCHAR(100) NULL
    - description TEXT NULL
    """

    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    versions = relationship(
        "Version",
        back_populates="process",
        cascade="all, delete-orphan",
        order_by="Version.version_number",
    )


class Version(Base):
    """
    Represents a single version of a process diagram.

    Table `versions` (SQLite):

    - id INTEGER PRIMARY KEY
    - process_id INTEGER NOT NULL (FK -> processes.id)
    - version_number INTEGER NOT NULL
    - version_name VARCHAR NULL / "" (human‑readable version label)
    - plantuml_code TEXT NOT NULL
    - prompt JSON NOT NULL (structured input / metadata)
    - llm_model VARCHAR(100) NOT NULL
    - tokens_used INTEGER NULL
    - status VARCHAR(20) NOT NULL DEFAULT 'draft'
    - created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    - image_path VARCHAR(255) NULL (path to rendered PNG diagram, optional)
    """

    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("processes.id"), nullable=False, index=True)

    version_number = Column(Integer, nullable=False)
    version_name = Column(String, nullable=False, default="")

    plantuml_code = Column(Text, nullable=False)
    prompt = Column(JSON, nullable=False)

    llm_model = Column(String(100), nullable=False)
    tokens_used = Column(Integer, nullable=True)

    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # New optional field for rendered PNG location (filesystem path or similar).
    image_path = Column(String(255), nullable=True)

    process = relationship("Process", back_populates="versions")
