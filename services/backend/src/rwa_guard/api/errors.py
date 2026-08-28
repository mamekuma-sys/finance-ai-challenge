from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def handle_api_error(_request: Request, error: APIError) -> JSONResponse:
        content: dict[str, Any] = {
            "error": {"code": error.code, "message": error.message},
            "is_synthetic": True,
        }
        return JSONResponse(status_code=error.status_code, content=content)
