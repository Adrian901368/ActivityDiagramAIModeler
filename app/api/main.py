from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(
    title="Activity Diagram AI Modeler",
    version="0.1.0",
    description="API pre generovanie UML Activity diagramov pomocou LLM.",
)


@app.get("/health")
async def health_check():
    """
    Jednoduchý health-check endpoint.
    Ak beží aplikácia a vie načítať konfiguráciu, vráti OK.
    """
    return {
        "status": "ok",
        "llm_provider": settings.llm.provider,
        "llm_model": settings.llm.model,
    }
