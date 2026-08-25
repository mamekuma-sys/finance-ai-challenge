from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rwa_guard.config import get_settings
from rwa_guard.domain.contracts import EvidenceReport
from rwa_guard.fixtures import build_demo_report


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["rwa-guard-api"]
    p0_ready: bool
    p1_chain: Literal["configured", "disabled"]


settings = get_settings()
app = FastAPI(
    title="RWA Guard API",
    version="0.1.0",
    description="Evidence-bound tokenized-security assurance API",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_web_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health", response_model=HealthResponse, tags=["operations"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="rwa-guard-api",
        p0_ready=True,
        p1_chain="configured" if settings.kaia_rpc_url else "disabled",
    )


@app.get("/v1/demo/evidence-report", response_model=EvidenceReport, tags=["demo"])
def demo_evidence_report() -> EvidenceReport:
    """Return a deterministic synthetic report without model or RPC dependencies."""

    return build_demo_report()
