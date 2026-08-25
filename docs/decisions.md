# RWA Guard 결정 로그

## ADR-001 — 제품 전환과 저장소 재스캐폴딩

- 날짜: 2026-08-25
- 상태: 승인
- 결정: 기존 프로젝트 코드·문서를 삭제하고 RWA Guard를 저장소의 유일한 활성 제품으로 전환한다.
- 근거: `docs/research/competition-fit.md`, `docs/product/prd.md`
- 결과: 활성 코드는 `apps/`, `services/`, `chain/`, `contracts/`, `data/`, `infra/`에만 둔다.

## ADR-002 — P0와 P1의 런타임 격리

- 날짜: 2026-08-25
- 상태: 승인
- 결정: 문서–코드 검증 P0는 RPC·Realtime·가격모델 없이 작동한다. P1 라이브 체인 기능은 9월 3일 승격 게이트를 적용한다.
- 결과: 모든 온체인 payload에 `mode=LIVE|REPLAY`를 강제한다.

## ADR-003 — 계약 우선 통합

- 날짜: 2026-08-25
- 상태: 승인
- 결정: Pydantic/OpenAPI를 런타임 원본으로 발전시키되, 초기 병렬 개발은 `contracts/schemas/`와 example payload를 팀 간 계약으로 사용한다.
- 결과: schema 변경은 생산자·소비자·example을 함께 갱신한다.
