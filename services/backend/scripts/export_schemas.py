import json
from pathlib import Path

from rwa_guard.domain.contracts import (
    CodeFinding,
    ControlSpec,
    EvidenceReport,
    MismatchFinding,
    OnchainEvidence,
    ScanRun,
)

MODELS = {
    "control-spec": ControlSpec,
    "code-finding": CodeFinding,
    "onchain-evidence": OnchainEvidence,
    "mismatch-finding": MismatchFinding,
    "scan-run": ScanRun,
    "evidence-report": EvidenceReport,
}


def main() -> None:
    repository = Path(__file__).resolve().parents[3]
    destination = repository / "contracts" / "generated"
    destination.mkdir(parents=True, exist_ok=True)
    for name, model in MODELS.items():
        path = destination / f"{name}.schema.json"
        path.write_text(
            json.dumps(model.model_json_schema(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
