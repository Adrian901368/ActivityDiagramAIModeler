from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # CORS for frontend

from app.core.config import settings
from app.api.v1.endpoints import router as v1_router
from app.database.session import init_db

app = FastAPI(
    title="Activity Diagram AI Modeler",
    version="1.0.0",
    description="API for generating UML Activity diagrams by LLM.",
    docs_url="/api-docs",
    redoc_url="/api-redoc",
    openapi_url="/api-schema",
)

# Allow frontend (Vite dev server) to call this API
origins = [
    "http://localhost:5173",  # Vite dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
async def healthcheck() -> dict:
    """Simple health-check endpoint."""
    return {
        "status": "ok",
        "llm_provider": settings.llm.provider,
        "llm_model": settings.llm.model,
    }


@app.get("/", tags=["meta"])
async def root() -> dict:
    """Root endpoint - quick check that the API is running."""
    return {"message": "ActivityDiagramAIModeler API runs."}


@app.on_event("startup")
def on_startup() -> None:
    """Application startup hook. Initializes the database."""
    init_db()


# v1 API router
app.include_router(v1_router, prefix="/api/v1")
