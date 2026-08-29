# RWA Guard 인프라

팀원 D의 기본 소유 경로이며 DB migration은 팀원 B와 공동 검토한다.

## 로컬 실행

저장소 루트에서 `.env.example`을 `.env`로 복사하고 `POSTGRES_PASSWORD`,
`OPERATOR_TOKEN`, `OPERATOR_ID`, `OPERATOR_ACCESS_CODE`,
`OPERATOR_SESSION_SECRET`을 강한 새 값으로 채운다. secret은 커밋하지 않는다.

```powershell
docker compose --env-file .env -f infra/docker-compose.yml config
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

- 공개 진입점: nginx proxy `http://localhost:3000`
- API readiness: `http://localhost:3000/backend-api/health/ready`
- Web BFF readiness: `http://localhost:3000/api/readiness`
- Web, API, PostgreSQL은 Compose 내부 네트워크에만 있고 host 포트를 노출하지 않는다.
- worker는 API와 같은 image, 다른 command를 사용한다.
- API와 worker image에는 P0 문서 1개, 취약 Solidity fixture 2개와 SHA-256
  manifest만 `/opt/rwa-guard-fixtures`에 포함한다. 두 서비스는 동일한
  `RWA_GUARD_FIXTURE_ROOT`를 사용하며 build 중 manifest 검증에 실패하면 image가
  생성되지 않는다. Root Docker context는 allowlist `.dockerignore`로 `.git`,
  `.env`, node_modules와 기타 데이터를 전송하지 않는다.
- 모든 서비스는 production 모드이며 insecure operator fallback은 false다.
  로컬 HTTP에서 Secure cookie가 전송되지 않는 문제만 해결하도록 Web에
  `ALLOW_INSECURE_LOCAL_SESSION=true`와 정확한
  `PUBLIC_WEB_ORIGIN=http://localhost:3000`을 기본값으로 전달한다. 이 예외는
  `operator-boundary.ts`에서 loopback HTTP만 허용한다.
- nginx는 외부 `X-Real-IP`/`X-Forwarded-For`를 폐기하고 `$remote_addr`로
  덮어쓴다. Host와 protocol은 보존되어 Web의 Origin/Host CSRF 검증과 일치한다.
- Web은 proxy가 덮어쓴 `x-real-ip`만 신뢰한다.

## 외부 HTTPS 배포

`.env`에서 공개 origin 전체(scheme, host, 비기본 port가 있으면 port 포함)를
지정하고 로컬 HTTP 세션 예외를 끈다.

```dotenv
PUBLIC_WEB_ORIGIN=https://guard.example
ALLOW_INSECURE_LOCAL_SESSION=false
```

두 값은 `docker compose config`를 거쳐 Web에 전달되며 `PUBLIC_WEB_ORIGIN`은
API에도 전달된다. HTTPS reverse proxy는 실제 공개 Host와 HTTPS scheme을 Web까지
보존해야 한다. CSRF 검사는 scheme-host-port가 정확히 일치하지 않으면 거부한다.
브라우저 API는 계속 same-origin `/backend-api`를 사용하고 operator token과 session
secret에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

P1 RPC·Realtime 장애가 P0 API readiness를 실패시키지 않도록 유지한다. signer key는 Docker image, compose 파일, 브라우저 환경변수에 넣지 않는다.
