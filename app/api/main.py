# app/api/main.py
"""
FastAPI application entry point.

Configures CORS, mounts static files, registers the v1 router,
and initialises the database on startup.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

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

# Allow frontend (Vite dev server + Vercel production) to call this API.
# NOTE: explicit header list is required — using ["*"] with
# allow_credentials=True breaks CORS preflight in Safari/WebKit
# for custom headers like X-User-Email.
_extra_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra = [o.strip() for o in _extra_origins.split(",") if o.strip()]

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *_extra,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-User-Email",
    ],
    expose_headers=["Content-Type"],
)

# Serve generated PNG diagrams as static files
DIAGRAMS_DIR = os.getenv("DIAGRAMS_DIR", "generated_diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)
app.mount(
    "/generated_diagrams",
    StaticFiles(directory=DIAGRAMS_DIR),
    name="generated_diagrams",
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
    """Root endpoint – quick check that the API is running."""
    return {"message": "ActivityDiagramAIModeler API runs."}


@app.on_event("startup")
def on_startup() -> None:
    """Application startup hook. Initialises the database."""
    init_db()


# v1 API router
app.include_router(v1_router, prefix="/api/v1")