"""Content Suite — FastAPI app entrypoint."""

from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers import audit, auth, brand, content  # noqa: E402
from services.error_handlers import register_error_handlers  # noqa: E402
from services.tracing import init_langfuse  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_langfuse()
    yield


app = FastAPI(
    title="Content Suite API",
    description="Reto técnico — plataforma de consistencia de marca con RAG híbrido y auditoría multimodal.",
    version="0.1.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in os.environ.get(
    "CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router)
app.include_router(brand.router)
app.include_router(content.router)
app.include_router(audit.router)


@app.get("/healthz", tags=["meta"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
