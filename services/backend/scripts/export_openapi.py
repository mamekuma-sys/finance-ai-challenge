"""Export the FastAPI OpenAPI document.

Pydantic 모델이 런타임 계약의 원본이고, 이 script는 그 원본에서 OpenAPI를 뽑는다.
프론트 TypeScript 타입은 여기서 생성된 문서만 소비한다.

    python scripts/export_openapi.py
"""

import json
from pathlib import Path

from rwa_guard.api.main import app


def main() -> None:
    repository = Path(__file__).resolve().parents[3]
    destination = repository / "contracts" / "generated" / "openapi.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {destination}")


if __name__ == "__main__":
    main()
