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
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    versions = relationship("Version", back_populates="process", cascade="all, delete-orphan")


class Version(Base):
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

    process = relationship("Process", back_populates="versions")
