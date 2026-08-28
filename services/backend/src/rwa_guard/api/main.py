from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker

from rwa_guard.api.errors import install_error_handlers
from rwa_guard.api.routes import demo_evidence_report, health, router
from rwa_guard.config import Settings, get_settings
from rwa_guard.db.session import SessionFactory


def create_app(
    *,
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    active_settings = settings or get_settings()
    application = FastAPI(
        title="RWA Guard API",
        version="0.2.0",
        description="Evidence-bound tokenized-security assurance API",
        separate_input_output_schemas=False,
    )
    application.state.settings = active_settings
    application.state.session_factory = session_factory or SessionFactory
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[active_settings.public_web_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type", "Authorization"],
    )
    install_error_handlers(application)
    application.include_router(router)
    return application


app = create_app()

__all__ = ["app", "create_app", "demo_evidence_report", "health"]
