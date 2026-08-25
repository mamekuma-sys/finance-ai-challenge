# RWA Guard 인프라

팀원 D의 기본 소유 경로이며 DB migration은 팀원 B와 공동 검토한다.

## 로컬 실행

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Web은 별도로 `apps/web`에서 실행한다.
- API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- worker는 API와 같은 image, 다른 command를 사용한다.

P1 RPC·Realtime 장애가 P0 API readiness를 실패시키지 않도록 유지한다. signer key는 Docker image, compose 파일, 브라우저 환경변수에 넣지 않는다.
