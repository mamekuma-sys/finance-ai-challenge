from collections.abc import Iterator
from dataclasses import dataclass
from secrets import compare_digest
from typing import cast

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker

from rwa_guard.api.errors import APIError
from rwa_guard.config import Settings
from rwa_guard.domain.contracts import ActorType


@dataclass(frozen=True)
class OperatorContext:
    actor_type: ActorType
    actor_id: str
    authentication_mode: str


def mutation_auth_ready(settings: Settings) -> bool:
    configured = bool(settings.operator_token and settings.operator_id)
    if settings.app_env.lower() == "production":
        return configured
    return configured or settings.allow_insecure_demo_operator


def require_operator(request: Request) -> OperatorContext:
    settings = get_app_settings(request)
    configured = bool(settings.operator_token and settings.operator_id)
    if settings.app_env.lower() == "production" and not configured:
        raise APIError(
            503,
            "OPERATOR_AUTH_NOT_CONFIGURED",
            "mutation authentication is not configured",
        )

    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, supplied = authorization.partition(" ")
        if (
            not configured
            or scheme.lower() != "bearer"
            or not supplied
            or not compare_digest(supplied, settings.operator_token or "")
        ):
            raise APIError(401, "OPERATOR_UNAUTHORIZED", "operator authentication failed")
        return OperatorContext(
            actor_type=ActorType.OPERATOR,
            actor_id=settings.operator_id or "",
            authentication_mode="CONFIGURED_BEARER",
        )

    if settings.app_env.lower() != "production" and settings.allow_insecure_demo_operator:
        return OperatorContext(
            actor_type=ActorType.INSECURE_DEMO,
            actor_id="demo-operator",
            authentication_mode="INSECURE_DEMO",
        )
    if not configured:
        raise APIError(
            503,
            "OPERATOR_AUTH_NOT_CONFIGURED",
            "mutation authentication is not configured",
        )
    raise APIError(401, "OPERATOR_UNAUTHORIZED", "Bearer operator token is required")


def get_app_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_session(request: Request) -> Iterator[Session]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session
