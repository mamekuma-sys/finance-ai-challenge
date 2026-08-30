from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Final

from rwa_guard.config import Settings

MANIFEST_PATH: Final = "fixtures/p0-manifest.json"
REQUIRED_FIXTURE_FILES: Final = frozenset(
    {
        "data/synthetic/documents/issuance-terms-01.txt",
        "chain/src/fixtures/VulnerableRwaToken.sol",
        "chain/src/fixtures/VulnerableOracle.sol",
    }
)


class FixtureUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class FixtureStore:
    root: Path
    version: str

    def path(self, relative: str) -> Path:
        candidate = (self.root / PurePosixPath(relative)).resolve()
        if not candidate.is_relative_to(self.root):
            raise FixtureUnavailable(f"fixture path escapes root: {relative}")
        return candidate

    def read_bytes(self, relative: str) -> bytes:
        try:
            return self.path(relative).read_bytes()
        except OSError as error:
            raise FixtureUnavailable(f"required fixture is unavailable: {relative}") from error

    def read_text(self, relative: str) -> str:
        return self.read_bytes(relative).decode("utf-8")


def _discover_development_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / MANIFEST_PATH).is_file():
            return parent
    raise FixtureUnavailable(
        "development fixture root was not found; set RWA_GUARD_FIXTURE_ROOT"
    )


def _manifest(root: Path) -> tuple[str, dict[str, str]]:
    manifest_path = root / MANIFEST_PATH
    try:
        payload: Any = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FixtureUnavailable(
            f"fixture hash manifest is unavailable: {manifest_path}"
        ) from error
    version = payload.get("version") if isinstance(payload, dict) else None
    files = payload.get("files") if isinstance(payload, dict) else None
    if not isinstance(version, str) or not version:
        raise FixtureUnavailable("fixture hash manifest has no valid version")
    if not isinstance(files, dict) or not REQUIRED_FIXTURE_FILES <= files.keys():
        raise FixtureUnavailable("fixture hash manifest is missing required P0 files")
    if not all(isinstance(path, str) and isinstance(digest, str) for path, digest in files.items()):
        raise FixtureUnavailable("fixture hash manifest contains invalid entries")
    return version, files


def fixture_store_for_settings(settings: Settings) -> FixtureStore:
    configured_root = settings.rwa_guard_fixture_root
    if configured_root is None:
        if settings.app_env.lower() == "production":
            raise FixtureUnavailable(
                "production fixture root is not configured; set RWA_GUARD_FIXTURE_ROOT"
            )
        configured_root = _discover_development_root()
    root = configured_root.expanduser().resolve()
    if not root.is_dir():
        raise FixtureUnavailable(
            f"fixture root does not exist; set RWA_GUARD_FIXTURE_ROOT: {root}"
        )
    version, manifest = _manifest(root)
    store = FixtureStore(root, version)
    for relative in REQUIRED_FIXTURE_FILES:
        expected = manifest[relative]
        actual = f"sha256:{hashlib.sha256(store.read_bytes(relative)).hexdigest()}"
        if expected != actual:
            raise FixtureUnavailable(f"fixture hash mismatch: {relative}")
    return store
