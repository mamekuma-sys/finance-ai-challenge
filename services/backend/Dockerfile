FROM ghcr.io/foundry-rs/foundry@sha256:8347b728d5d393dac1c018691b36f506d23b9dcd78341d40ea0fcb11c3a19cdd AS foundry

RUN mkdir -p /tmp/rwa-guard-bootstrap/src \
    && printf '%s\n' \
      'pragma solidity ^0.8.24;' \
      'contract CompilerBootstrap {}' \
      > /tmp/rwa-guard-bootstrap/src/CompilerBootstrap.sol \
    && printf '%s\n' \
      '[profile.default]' \
      'src = "src"' \
      'solc_version = "0.8.24"' \
      > /tmp/rwa-guard-bootstrap/foundry.toml \
    && forge build --root /tmp/rwa-guard-bootstrap

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY --from=foundry /usr/local/bin/forge /usr/local/bin/forge
COPY --from=foundry /home/foundry/.svm /root/.svm

COPY services/backend/pyproject.toml services/backend/README.md ./
COPY services/backend/src ./src

RUN python -m pip install --upgrade pip \
    && python -m pip install .

ENV RWA_GUARD_FIXTURE_ROOT=/opt/rwa-guard-fixtures
COPY fixtures/p0-manifest.json /opt/rwa-guard-fixtures/fixtures/p0-manifest.json
COPY data/synthetic/documents/issuance-terms-01.txt /opt/rwa-guard-fixtures/data/synthetic/documents/issuance-terms-01.txt
COPY chain/src/fixtures/VulnerableRwaToken.sol /opt/rwa-guard-fixtures/chain/src/fixtures/VulnerableRwaToken.sol
COPY chain/src/fixtures/VulnerableOracle.sol /opt/rwa-guard-fixtures/chain/src/fixtures/VulnerableOracle.sol

RUN python -c "from rwa_guard.config import Settings; from rwa_guard.fixture_store import fixture_store_for_settings; fixture_store_for_settings(Settings(app_env='production'))"

EXPOSE 8000

CMD ["uvicorn", "rwa_guard.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
