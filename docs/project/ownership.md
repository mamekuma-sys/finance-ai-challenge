# 4인 팀 소유권

화면, AI 역할, 세부 업무, 브랜치·PR 및 풀스택 통합 규칙을 포함한 팀 공유본은
[`team-development-operating-plan.md`](team-development-operating-plan.md)를 따른다.
역할별 package와 실행 환경은 [`team-technical-stack.md`](team-technical-stack.md)를 따른다.

| 트랙 | 기본 소유 경로 | 책임 | 병합 전 필수 확인 |
|---|---|---|---|
| A 제품·프론트 | `apps/web/` | Assurance Ledger, Evidence Spine, diff, 리포트 UI | API 타입, 실패 상태, LIVE/REPLAY 라벨 |
| B 문서 AI·백엔드 | `services/backend/` | Pydantic, FastAPI, 문서 추출, job, DB, report | schema/example, migration, 부분 실패 |
| C 컨트랙트 보안 | `chain/`, backend `pipelines/contract.py` | fixture, Slither/AST/룰, Foundry, 평가셋 | 결정적 근거, rule version, expected result |
| D 온체인·데이터·운영 | `data/synthetic/`, `infra/`, backend chain worker | Kairos, 가격, Replay, 배포, uptime | receipt, cursor, dedupe, secret 경계 |

## 공유 파일 변경 규칙

다음 경로는 단일 트랙 소유가 아니다.

- `contracts/`: 네 트랙 리뷰
- `docs/product/prd.md`: 제품 범위 변경 승인 필요
- `docs/architecture/`: API·런타임 경계 변경 승인 필요
- `infra/supabase/migrations/`: B와 D 공동 확인
- `.env.example`: 실제 비밀값이 없는지 B와 D 확인

## 매일 통합 체크

1. example JSON이 모든 JSON Schema를 통과한다.
2. backend가 같은 필드명과 enum을 반환한다.
3. Web이 Unknown/Needs review/Replay를 정상으로 표현하지 않는다.
4. 취약 fixture와 수정 fixture의 결과 차이가 유지된다.
5. P1 장애가 P0 health와 scan path에 영향을 주지 않는다.
