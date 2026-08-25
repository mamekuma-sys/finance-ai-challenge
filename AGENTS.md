# AGENTS.md — RWA Guard 공용 구현 계약

## 프로젝트

2026 금융 AI Challenge에 제출할 4인 팀 프로젝트다. RWA Guard는 합성 토큰증권의 발행 문서, 스마트컨트랙트 코드, 온체인 이벤트 사이의 통제 불일치를 근거와 함께 보여주는 웹서비스다.

- 제출 마감: 2026-09-07 10:00 KST
- URL 유지: 2026-09-07 11:00 ~ 2026-09-11 23:59
- 제품 단일 진실: `docs/product/prd.md`
- 기술·시각 단일 진실: `docs/architecture/stack-and-visual-direction.md`
- 팀 계약: `contracts/schemas/`와 `docs/project/ownership.md`

## 4개 작업 트랙

- A — `apps/web/`: Next.js, Evidence Spine, diff, 리포트, 상태 표시
- B — `services/backend/`: FastAPI, Pydantic, PDF/AI pipeline, job, DB
- C — `chain/` 및 backend contract pipeline: Solidity fixture, Slither/AST/룰, Foundry
- D — `data/synthetic/`, chain worker, `infra/`: Kairos, 가격, Replay, 배포 운영

공통 계약 파일을 바꿀 때는 생산자, 소비자, example payload를 같은 변경에서 갱신한다.

## 범위 불변식

1. P0가 모두 통과하기 전에는 자산 유형, 네트워크, 핵심 룰을 늘리지 않는다.
2. 합성 상업용 부동산 수익증권 1종, Kaia Kairos 1개, 핵심 결함 3종만 공식 지원한다.
3. AI는 문서 구조화, 의미 매핑 후보, 설명을 담당한다. 확정 Critical/High는 결정적 코드·규칙 근거를 반드시 가진다.
4. AI 단독 결과는 `NEEDS_REVIEW`이며 `CONFIRMED`로 승격할 수 없다.
5. 모든 Critical/High는 문서 page/span과 코드 file/line을 연결한다.
6. 온체인 데이터는 `LIVE` 또는 `REPLAY`를 반드시 노출한다. 실제 receipt 없는 데이터를 LIVE로 표시하지 않는다.
7. P1 장애는 P0 문서–코드 검사와 리포트 생성을 중단시키지 않는다.
8. 자동 발행 승인, 거래정지, 실제 자금 이동을 구현하지 않는다.
9. 실제 금융데이터와 개인정보를 저장하지 않는다. 모든 fixture는 `is_synthetic=true`다.
10. 미실측 정확도·지연·가용성 수치를 완료 실적으로 표현하지 않는다.

## 파일 규칙

- `docs/competition/`은 참조용이며 수정하지 않는다.
- 삭제된 이전 프로젝트의 코드·문서·도메인 규칙을 Git 이력에서 복원하거나 재사용하지 않는다.
- 외부 코드·데이터를 추가하면 라이선스와 출처를 `NOTICE.md` 또는 해당 데이터 README에 기록한다.
- 환경변수와 signer key를 커밋하지 않는다. `.env.example`에는 이름과 설명만 둔다.
- 파일 수정은 요청 범위 안에서 수행하고, 관련 없는 사용자 변경을 보존한다.

## 기본 검증

- Web: `cd apps/web && npm run verify`
- Backend: `cd services/backend && python -m pytest && python -m ruff check .`
- Solidity: `cd chain && forge build && forge test`
- 공통: `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1`

## 완료 정의

기능 완료는 화면 존재가 아니라 합성 fixture를 사용한 `ControlSpec → CodeFinding → MismatchFinding → EvidenceReport` 경로가 재현 가능하고, 실패·제한·LIVE/REPLAY 상태가 정직하게 표시되는 것을 뜻한다.
