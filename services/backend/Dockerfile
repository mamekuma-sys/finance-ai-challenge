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

COPY pyproject.toml README.md ./
COPY src ./src

RUN python -m pip install --upgrade pip \
    && python -m pip install .

EXPOSE 8000

CMD ["uvicorn", "rwa_guard.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
