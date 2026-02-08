from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(
    title="Activity Diagram AI Modeler",
    version="0.1.0",
    description="API for generating UML Activity diagrams by LLM.",
    docs_url="/api-docs",       # Swagger UI
    redoc_url="/api-redoc",     # ReDoc
    openapi_url="/api-schema",  # JSON schéma
)

@app.get("/health")
async def health_check():
    """
    Simple health-check endpoint.
    if runs, vráti OK.
    """
    return {
        "status": "ok",
        "llm_provider": settings.llm.provider,
        "llm_model": settings.llm.model,
    }

@app.get("/")
async def root():
    return {"message": "ActivityDiagramAIModeler API runs."}