from fastapi import FastAPI

from app.core.config import settings
from app.api.v1.endpoints import router as v1_router
from app.database.session import init_db

app = FastAPI(
    title="Activity Diagram AI Modeler",
    version="1.0.0",
    description="API for generating UML Activity diagrams by LLM.",
    docs_url="/api-docs",       # Swagger UI
    redoc_url="/api-redoc",     # ReDoc
    openapi_url="/api-schema",  # OpenAPI JSON schema
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


@app.on_event("startup")
def on_startup() -> None:
    """
    Application startup hook.

    Initializes the database (runs migrations / creates tables).
    """
    init_db()


# v1 API – všetky cesty definované v app.api.v1.endpoints
# budú mať prefix /api/v1, napr.:
# POST /api/v1/generate
# GET  /api/v1/catalog/{process_id}
# GET  /api/v1/catalog/processes
app.include_router(v1_router, prefix="/api/v1")
