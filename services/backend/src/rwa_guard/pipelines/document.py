from pathlib import Path


def assert_supported_document(path: Path) -> None:
    """Fail closed before a document enters the extraction pipeline."""

    if path.suffix.lower() not in {".pdf", ".txt"}:
        raise ValueError("Only PDF and text issuance documents are supported in P0")
