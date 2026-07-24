# W1-A 구현 보고서

## 구현 요약

- `app/`을 Next.js App Router + TypeScript strict + Tailwind CSS 4로 스캐폴드했다.
  잠금 버전은 Next.js 16.2.11, React/React DOM 19.2.8, Tailwind CSS 4.3.3이다.
- `/` UI 페이지는 만들지 않았다. W1-A 범위에는 App Router 공통 layout과 설정만 남겼다.
- §4.1 계약 타입과 7개 런타임 열거값 배열을 단일 소스로 추가했다.
- R1~R7 규칙 표, severity, 공식 출처, 금지 문구, 규제 문구 레지스트리를 데이터로
  선언했다.
- 6개 상태 필드 전체 조합에 대해 결정적인 결과를 반환하는 조치 결정 총함수와 §4.1 전용
  직렬화 함수를 구현했다.
- `family_proxy` 수정자로 `notice:proxy_scope` 카드가 생성되는 경우에만
  `PRH-MOD-PROXY`를 모든 카드의 금지 행동 합집합에 추가했다.
- 행동 이벤트 이력(내 기기 보관)의 append-only 추가, 전이 거부, 정정, append 순서 기반
  환원, 연속 중복 축약을 순수 로직으로 구현했다.

## §4.5 실행 단계 대응

| 계약 단계 | 코드 대응 |
|---|---|
| ① 전체 수집 | `src/lib/decision/rules.ts`의 `RULES`, `engine.ts`의 `collectRows` |
| ② 위해 정렬·질문 삽입 | `severity.ts`의 `POTENTIAL_SEVERITY`, `engine.ts`의 `selectQuestionAxes`, `applyQuestionPosition`, `assertQuestionPlacement` |
| ③ merge_key 병합 | `engine.ts`의 `mergeRows`, `compareCollectedRows`, `uniqueInOrder` |
| ④ 전역 필수 후속 승격 | `engine.ts`의 `ensureWrittenFollowup` |
| ⑤ proxy·device·금지 합집합 수정자 | `engine.ts`의 `addProxyCard`, `collectProhibitedActions`, `applyModifiers` |
| ⑥ 슬롯 예약·축출·직렬화 | `engine.ts`의 `reserveVisibleSlots`, `assignPriorities`, `serializeActionCard`, `serializeDecisionResult` |

## 테스트 결과

`npm run verify` 실행 결과는 exit 0이다.

| 검증 | 결과 |
|---|---|
| TypeScript strict typecheck | 통과 |
| ESLint(create-next-app 기본 구성) | 통과 |
| Vitest(node 환경) | 4개 파일, 20개 테스트 통과 |
| 상태 조합 수 | 정확히 1,152개를 생성해 assert |
| 총함수·형태·연속 priority | 1,152개 전부 통과 |
| 긴급 우선 불변식 | 1,152개 전부 통과 |
| `already_sent` 서면 후속 단일·노출 보장 | 1,152개 중 해당 조합 전부 통과 |
| `next_steps` 무손실·merge_key 무중복 | 1,152개 전부 통과 |
| 목적·공식 출처 합집합 독립 재계산 | 1,152개 전부 통과 |
| 결정론 | 1,152개 전부 2회 깊은 비교 통과 |
| `do_not_show_when=[]` 게이트 | 1,152개 전부 통과 |
| device 수정자 | 해당 조합 전부 통과 |
| proxy 수정자·마지막 노출 | 해당 조합 전부 통과 |
| proxy 안내 카드 ↔ `PRH-MOD-PROXY` 양방향 정합성 | 1,152개 전부 통과 |
| 템플릿·출처 메타데이터 무결성 | 모든 결과 카드와 레지스트리 통과 |
| §4.5.4 인수 스냅샷 a~e | 카드 순서·접힘·금지 합집합·템플릿 버전 모두 통과 |
| ActionFact 전이·정정·환원·중복 축약 | 통과 |
| Next.js production build | 통과 (`/` 페이지 없이 `/_not-found`만 생성) |

전수 속성 파일은 4개 속성 묶음이 각각 1,152개 상태를 순회한다. 병합 기대값은 엔진 출력에서
복사하지 않고, 일치한 `RULES` 행에서 목적·출처·템플릿 집합을 별도로 재계산한다.

## 계약 해석과 근거

1. 확인 질문의 잠재 severity가 확인된 최고 severity보다 앞서지 않는 경우, 단순 severity
   정렬과 §4.5.1 ②의 명시 위치 규칙이 비등가인 조합이 존재했다. 명시 규칙을 우선했으며
   재현 근거는 `contract-notes.md`에 기록했다.
2. §4.1 `ActionCard`에 없는 `title`, `severity`, `forced`, `question_axes`는
   `DecisionActionCard` 내부 필드로 두고, `serializeActionCard`가 §4.1 필드만 반환한다.
3. 시행일을 확인할 수 없는 안내성 템플릿은 지시대로 확인일 `2026-07-25`를 날짜 필드에
   두고 `source_effective_date_confirmed=false`로 명시했다. 지급정지·3영업일 서면 신청
   템플릿만 확인된 법 시행일 `2011-09-30`과 `true`를 사용했다.
4. §4.6의 화살표 전이는 인접 순방향 전이로 검증했다. `unknown`과 `not_applicable`은 어느
   상태에서든 기록할 수 있고, 이후 사용자가 확인을 재개할 수 있도록 두 특수 상태 다음에는
   진행 상태 기록을 허용했다.
5. 정정된 계약에 따라 §4.5.4 d행의 금지 행동을 R3만이 아닌 R3∪proxy로 적용했다.
   §4.5.3 하단의 “대리 실행이 가능하다는 표현은 금지한다”는 근거에 맞춰,
   `notice:proxy_scope` 카드 존재와 `PRH-MOD-PROXY`의 모든 카드 포함 여부를 1,152개
   전 조합에서 양방향으로 검증했다. 절차 카드가 없어 proxy 카드가 생성되지 않는 조합에는
   이 금지 문구도 추가하지 않는다.

## 남은 TODO

- W1-A 범위 내 남은 TODO는 없다.
- `/` UI, shadcn/ui, 브라우저 `sessionStorage` 연결은 후속 W1-B 범위다.
