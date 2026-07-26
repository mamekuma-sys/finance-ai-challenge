# W-A 계약·엔진 Blocker 수정 보고서

- 기준일: 2026-07-25
- 작업 범위: `app/src/lib/**`와 결정 계층 테스트
- 계약 기준: `docs/planning/22-revision-plan-r6.md` I1~I4,
  `docs/planning/11-spec-draft.md` §4.5.3·§4.7·§6.3·§9
- 결과: A1~A5 결정 계층 회귀 통과, `cd app && npm run verify` exit 0

## A1 입력 검증 — 명시적 거부

수정 위치:

- `app/src/lib/decision/validation.ts:10-113`
  - 정확한 6개 키와 각 필드의 계약 enum을 런타임에서 검사한다.
  - 누락·추가 키, 비객체, 배열, 계약 밖 값을
    `InvalidIncidentStateError` / `INVALID_INCIDENT_STATE`로 거부한다.
  - 오류에는 계약 필드명과 허용값만 담고 입력 값·추가 키 이름은 반사하지 않는다.
- `app/src/lib/decision/engine.ts:503-533`
  - 기존 `decideActions(state: IncidentState)` 시그니처를 유지하면서 진입 시 검증한다.
  - 신규 `decideActionsSafe(state: unknown)` Result API를 추가했다.
- `app/src/lib/decision/index.ts:1-7`
  - 검증 오류·함수를 기존 결정 모듈 진입점에서 하위 호환 export한다.

회귀 테스트:

- `app/src/lib/decision/__tests__/validation.test.ts:56-138`
  - 빈 객체, 부분 입력, 계약 밖 enum, `null`, `undefined`, 배열, 추가 키 거부
  - 입력 비반사
  - 유효 1,152조합 거부 0건

판단 근거:

- §6.3 QA 1단계의 스키마·열거형 검증을 엔진 공개 경계에서 먼저 수행한다.
- 잘못된 입력을 정상적인 “행동 없음” 결과로 바꾸지 않아 §9.3 총함수 결과와
  입력 오류를 구분한다.

## A2 템플릿 활성 게이트

수정 위치:

- `app/src/lib/templates/types.ts:3-23`
  - `TemplateStatus = active | unconfirmed | expired`와 레지스트리 기준 상태를 추가했다.
- `app/src/lib/templates/registry.ts:38-121`
  - 시행일 미확인 5종은 `unconfirmed`, 확인된 2종은 `active`로 명시했다.
  - 템플릿은 삭제하지 않아 행동 카드와 `template_versions` 계약을 보존했다.
- `app/src/lib/templates/registry.ts:128-211`
  - 단일 `resolveTemplate(version, referenceDate)`를 추가했다.
  - `confirmed !== true`이면 `unconfirmed`, `next_review_at < referenceDate`이면
    `expired`이며 두 상태 모두 `body` 없이 명시적 실패 결과를 반환한다.
  - 기준일은 `YYYY-MM-DD` 인자로만 받고 내부 현재 시각을 읽지 않는다.
- `app/src/lib/templates/registry.ts:213-266`
  - 메타데이터·날짜·본문·상태를 검사하고,
    `active` 표시와 미확인 시행일이 결합되면 레지스트리 게이트를 실패시킨다.

회귀 테스트:

- `app/src/lib/decision/__tests__/registry.test.ts:134-187`
  - 현재 5종 `unconfirmed` 명시
  - unconfirmed·expired 본문 resolve 실패
  - active 본문만 승인
  - 기준일 경계 전후 상태 변경
  - active/confirmed 모순 레지스트리 거부

판단 근거:

- §4.7의 “시행일 미확인 비활성”과 재검토일 경과 시 운영 노출 차단을 같은
  resolver 결과로 표현했다.
- 결정 엔진은 카드와 긴급 행동을 계속 산출하고, 검증되지 않은 템플릿 본문만
  resolver에서 차단하므로 r6 I4의 행동 유지 원칙을 지킨다.

## A3 출처 entailment 보강

수정 위치:

- `app/src/lib/decision/sources.ts:1-95`
  - `SRC-FSC-CARDNEWS`, `SRC-KISA-PHISHING`, `SRC-FSC-1332`,
    `SRC-LAW-DECREE3`를 추가하고 기존 `SRC-KOREA-1394`를 유지했다.
- `app/src/lib/decision/rules.ts:79-352`
  - r6 I1의 행 단위 매핑대로 R1~R5·R7의 출처만 보강했다.
  - R1~R7 행동 문구·순서·merge key·severity는 변경하지 않았다.
- `app/src/lib/decision/engine.ts:248-276`
  - 전역 서면 후속 생성 경로에도 시행령 제3조 출처를 동일하게 보존했다.
- `app/src/lib/decision/__tests__/source-entailment-fixtures.ts:1-279`
  - `규칙·행 → 핵심 동사 → source_id → 원문 지지 문장` 독립 픽스처를 고정했다.
- `app/src/lib/decision/__tests__/source-entailment.test.ts:36-102`
  - 모든 규칙 행의 픽스처 존재·레지스트리 참조를 검사한다.
  - 1,152조합의 노출 카드와 `next_steps`에서 병합에 기여한 모든 행의 지지
    출처가 보존되는지 전수 검사한다.

회귀 테스트 결과:

- 유효 조합: 1,152
- 검사 카드: 7,350 (`actions + next_steps`)
- entailment 위반: 0

판단 근거:

- 출처 존재성만 검사하지 않고, 독립 픽스처의 핵심 동사별 지지 출처가 실제 카드의
  `official_sources`에 포함되는지 대조한다.
- 카드 병합 뒤 하나의 출처만 우연히 남아 통과하지 않도록 기여한 각 규칙 행을 모두
  검사한다.

## A4 직렬화 권한 한계

수정 위치:

- `app/src/lib/decision/engine.ts:40-41`
  - 기존 화면·명세의 고정 권한 한계 문구를 상수로 둔다.
- `app/src/lib/decision/engine.ts:491-500`
  - `serializeDecisionResult`가 항상
    `{ actions, next_steps, disclaimer }`를 반환한다.
  - 기존 `actions`·`next_steps`와 함수 인자 시그니처는 유지했다.

회귀 테스트:

- `app/src/lib/decision/__tests__/serialization.test.ts:37-49`
  - 1,152개 모든 직렬화 결과에서 비어 있지 않은 동일 disclaimer를 확인한다.

직접 실행 결과:

- disclaimer 누락: 0

## A5 독립 인수 픽스처

수정 위치:

- `app/src/lib/decision/__tests__/snapshot-fixtures.ts:1-168`
  - §4.5.4 a~e의 6개 입력 필드, 노출 merge key 순서, `next_steps`,
    금지 문구 합집합, 템플릿 버전을 엔진 호출 없이 리터럴로 export한다.
- `app/src/lib/decision/__tests__/engine.snapshots.test.ts:34-106`
  - 기존 스냅샷 검사를 위 독립 픽스처 기반으로 바꿨다.
  - R3 서면 후속의 문구·출처·버전 고정 검사는 별도로 유지했다.

판단 근거:

- UI 테스트가 엔진 결과로 기대값을 다시 만들지 않고
  `DECISION_SNAPSHOT_FIXTURES`를 직접 사용할 수 있다.
- 픽스처는 엔진·규칙·금지 레지스트리의 런타임 값을 import하지 않으며 타입만 참조한다.

## 직접 실행 증적

Vite SSR 로더로 실제 모듈을 불러 별도 실행했다.

```text
invalid_input:
  decideActions({})                         -> rejected, INVALID_INCIDENT_STATE
  transfer_state만 있는 부분 입력          -> rejected, INVALID_INCIDENT_STATE
  6개 필드 모두 계약 밖 값                 -> rejected, INVALID_INCIDENT_STATE

valid_domain:
  combinations=1152, rejected=0

templates:
  TPL-SAFE-DEVICE-001@1.0 / 2026-07-25
    -> ok=false, status=unconfirmed
  TPL-BANK-STOP-001@1.0 / 2026-09-01
    -> ok=true, status=active
  TPL-BANK-STOP-001@1.0 / 2026-09-02
    -> ok=false, status=expired

entailment:
  combinations=1152, checked_cards=7350, violations=0

serialization:
  missing_disclaimers=0
```

전체 검증:

```text
cd app && npm run verify
exit 0
typecheck PASS
lint PASS
test: 17 files, 76 tests PASS
production build PASS
```

## UI·호출부 후속 조치

이번 작업은 동시 작업 충돌 방지를 위해 `app/src/components/**`와 `app/src/app/**`를
수정하지 않았다. UI 담당자는 다음을 적용해야 한다.

1. `action-card.tsx`의 `TEMPLATE_REGISTRY` 직접 본문 조회를
   `resolveTemplate(version, referenceDate)` 호출로 교체한다.
2. `ok=false`이면 템플릿 본문과 “승인된 고정 문구” 표시를 숨기고,
   `unconfirmed` 또는 `expired` 상태와 `reason`을 사용자에게 표시한다.
   카드 자체·긴급 행동·`template_versions`는 숨기지 않는다.
3. UI·빌드 경계에서 신뢰할 수 있는 `referenceDate`를 명시적으로 주입한다.
   결정 엔진 내부에서 현재 시각을 만들지 않는다.
4. 외부 에이전트·REST·MCP 직렬화 경로는 `DecisionResult`를 직접 내보내지 말고
   `serializeDecisionResult`를 사용해 disclaimer를 함께 전달한다.
5. UI §4.5.4 테스트는
   `app/src/lib/decision/__tests__/snapshot-fixtures.ts`의
   `DECISION_SNAPSHOT_FIXTURES`를 import해 엔진 호출 없는 기대값으로 사용한다.
6. REST·MCP 등 `unknown` 입력 경계에서는 `InvalidIncidentStateError`를 안정적 오류로
   매핑하거나 `decideActionsSafe`를 사용한다. 오류 본문에 원 입력을 추가하지 않는다.

결정 계층 A1~A5에서 해결하지 못한 항목은 없다. 위 UI 항목은 이번 파일 소유권 제약에
따른 소비 계층 적용 작업이며, 새 API는 기존 export와 호출 시그니처를 보존한다.
