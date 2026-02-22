# app/api/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.api.v1.endpoints import router as v1_router
from app.database.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context.

    - Runs once on startup: initializes the database.
    - Runs cleanup code on shutdown (if needed in the future).
    """
    # Startup logic
    init_db()
    yield
    # Shutdown logic (currently nothing)


app = FastAPI(
    title="Activity Diagram AI Modeler",
    version="1.0.0",
    description="API for generating UML Activity diagrams by LLM.",
    docs_url="/api-docs",    # Swagger UI
    redoc_url="/api-redoc",  # ReDoc
    openapi_url="/api-schema",  # OpenAPI JSON schema
    lifespan=lifespan,
)


@app.get("/health", tags=["meta"])
async def health_check() -> dict:
    """
    Simple health-check endpoint.

    Returns basic information about the running API and LLM config.
    """
    return {
        "status": "ok",
        "llm_provider": settings.llm.provider,
        "llm_model": settings.llm.model,
    }


@app.get("/", tags=["meta"])
async def root() -> dict:
    """
    Root endpoint – quick check that the API is running.
    """
    return {"message": "ActivityDiagramAIModeler API runs."}


# v1 API – all routes from app.api.v1.endpoints
# will have the /api/v1 prefix, e.g.:
# POST /api/v1/generate
# GET  /api/v1/catalog/{process_id}
# GET  /api/v1/catalog/processes
app.include_router(v1_router, prefix="/api/v1")
