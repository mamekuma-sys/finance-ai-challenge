# RWA Guard Web

팀원 A의 기본 소유 경로다. Next.js App Router로 Assurance Ledger와 Evidence Spine을 구현한다.

```bash
npm install
npm run dev
npm run verify
```

- P0는 저장된 합성 fixture와 Replay만으로 렌더링되어야 한다.
- 실제 receipt가 없는 이벤트를 LIVE로 표시하지 않는다.
- API 계약은 backend OpenAPI에서 생성한 타입으로 교체한다.
- 브라우저 mutation은 `/api/backend/*` same-origin 경계를 거치며
  `BACKEND_OPERATOR_TOKEN`은 Next.js 서버에서만 backend로 전달한다.
- 브라우저 read API는 `NEXT_PUBLIC_API_BASE_URL=/backend-api` 같은 same-origin
  상대 경로만 사용한다. Server Components와 BFF/readiness는 서버 전용
  `BACKEND_API_BASE_URL`을 사용하며 이 내부 URL과 secret은 client bundle에
  노출하지 않는다.
- `OPERATOR_ACCESS_CODE` 검증 후 발급되는 서명·만료 HttpOnly 세션만
  allowlist mutation을 호출할 수 있다. 서명 키는 `OPERATOR_SESSION_SECRET`이다.
- Next 서버는 canonical client IP만 session secret으로 HMAC하며 User-Agent는
  fingerprint에 사용하지 않는다. 원본 IP를 저장하거나 backend로 전달하지 않고
  opaque fingerprint와 code만 검증 endpoint로 전달한다. 실패 제한의 단일 진실은
  backend DB이며 5회 실패 후 15분간 잠긴다.
- Production은 `TRUSTED_CLIENT_IP_HEADER`가 필수다. 배포 reverse proxy는 인터넷
  요청이 제공한 동명 header를 제거하고 실제 client IP 하나로 반드시 overwrite해야
  한다. 누락·복수·invalid IPv4/IPv6는 거부한다. Development/test의 loopback
  fallback은 `ALLOW_INSECURE_DEMO_OPERATOR=true`일 때만 허용한다.
- CSRF same-origin 검사는 Host/port와 scheme을 모두 비교한다. 신뢰 proxy는
  `X-Forwarded-Proto`를 연결의 실제 scheme으로 덮어써야 하며 복수·비정상
  protocol 값은 거부한다.
- Production session cookie는 기본적으로 항상 `Secure`다. 오직
  `ALLOW_INSECURE_LOCAL_SESSION=true`와 정확한 HTTP loopback
  `PUBLIC_WEB_ORIGIN`(허용된 로컬 port)이 함께 검증될 때만 로컬 실행에서
  `Secure`를 제거한다. 이 설정은 실배포 금지이며 readiness도 같은 정책
  helper로 잘못된 origin을 거부한다.
- `/api/readiness`는 위 서버 설정과 backend `/health/operator`,
  `/health/ready` bearer probe를 함께 확인한다. Backend probe는 rate-limit
  table, DB, 최신 worker heartbeat를 조회하며,
  브라우저에는 어떤 secret이나 DB 상세도 반환하지 않는다.
- 문서/scan의 QUEUED·RUNNING polling은 `NEXT_PUBLIC_POLL_TIMEOUT_MS`와
  `NEXT_PUBLIC_POLL_MAX_ATTEMPTS` 중 먼저 도달한 한계에서 멈춘다. worker
  readiness 실패도 즉시 중지하고 확인·재시도 상태를 표시한다.
- P0 인증은 구성된 단일 operator ID만 감사 actor로 기록한다. 실제 사용자별
  identity provider, 세션, 역할 기반 권한 관리는 아직 구현되지 않았다.
