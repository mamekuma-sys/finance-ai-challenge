# W1 AI 에이전트 중계 안전성 리뷰

- 기준일: 2026-07-25
- 관점: 사용자의 사건을 대신 판단하지 않고, W1 산출물을 읽어 사람에게 안전하게 중계해야 하는 AI 에이전트
- 증거 원칙: `w1a-report.md`·`w1b-report.md`의 주장은 구현 위치를 찾는 참고로만 사용했다. 채점 근거는 명세, 실제 코드, 테스트 코드, 직접 실행 결과다.
- 제외: 오케스트레이터가 별도 수정 중이라고 지정한 5개 알려진 결함은 이 리뷰의 결함·감점에 중복 반영하지 않았다. 제공된 브라우저·성능 실측값도 다시 측정하지 않았다.

## 1. 종합 판정

| 영역 | 점수 | 판정 요약 |
|---|---:|---|
| A. 계약·스키마 신뢰성 | 34 / 40 | 타입과 유효 도메인 전수성은 강하다. 일부 UI 인수 테스트는 기대값을 엔진에서 다시 만들어 독립 오라클이 아니다. |
| B. 기계 가독성·중계 안전성 | 23 / 40 | 기본 HTML 구조와 출처 배지는 좋지만, 과거 행동 이벤트의 의미가 현재 카드 제목으로 바뀌어 표시될 수 있고 권한 한계가 엔진 결과에 결합되지 않는다. |
| C. 오용·환각 방지 | 29 / 50 | 출처 ID와 비확률 표기는 좋다. 반면 미확인 템플릿의 활성 노출, 문구의 다중 원본, 안전 기기 전제와 전화 행동의 분리는 중계 안전성을 깨뜨린다. |
| D. 재사용·확장 | 10 / 30 | 코어 로직은 프레임워크 비의존적이지만 일반 Node에서 직접 import되지 않고, 규칙 버전과 런타임 입력 거부 계약이 없다. |
| **총점** | **96 / 160 (60.0%)** | **위험하다** |

**한 문장 결론:** 현재 산출물은 유효한 UI 입력 안에서는 일관되지만, 상태 변경 이력·비정상 입력·부분 인용 경계에서 에이전트가 “요청함/접수됨/안전한 기기에서 해야 함”을 잘못 중계할 수 있으므로 **이 산출물을 그대로 사람에게 중계하는 것은 위험하다.**

## 2. 항목별 채점표

| 항목 | 점수 | 근거(파일:라인 + 실제 인용) | 문제 |
|---|---:|---|---|
| A1 스키마 일치 | 10 / 10 | 명세 `docs/planning/11-spec-draft.md:217-302`의 `ActionCard`는 `purpose_slots`, `do_not_show_when`, `prohibited_actions`, 복수 `official_sources: string[]`, `next_steps`를 정의한다. 구현 `app/src/lib/contracts/types.ts:59-92`도 같은 필드명·타입으로 `official_sources: string[]`, `next_steps: ActionCard[]`를 둔다. 내부 확장 필드는 `app/src/lib/decision/engine.ts:43-50`의 `DecisionActionCard`에 격리되고, `:467-491` 직렬화가 §4.1 필드만 반환한다. | §4.1 대비 추가·개명·누락을 찾지 못했다. 내부 UI 필드도 계약 직렬화에서 제거된다. |
| A2 총함수 보장 | 10 / 10 | `app/src/lib/decision/__tests__/engine.exhaustive.test.ts:18-35`가 6개 열거 배열의 데카르트 곱을 만들고, `:138-160`, `:162-267`, `:270-353`의 각 테스트가 `expect(ALL_STATES).toHaveLength(1_152)` 뒤 `for (const state of ALL_STATES)`를 돈다. `app/src/lib/verification/__tests__/decision-artifact.test.ts:18-43`도 전 조합에서 실제 `decideActions`를 호출한다. | 유효 열거형 도메인에서는 샘플링·스킵이 없다. 직접 실행도 `count=1152`, `thrown=0`이었다. 비정상 입력은 D3에서 별도 감점한다. |
| A3 결정론 | 10 / 10 | 직접 `rg`한 결과 `app/src/lib/decision/**`의 실행 코드에는 `Date.now`, `Math.random`, `randomUUID`, 전역 가변 상태가 0건이다. `app/src/lib/decision/engine.ts:57-59`의 `Set`, `:184-231`의 `Map`, `:428-449`의 `Set`은 모두 고정 `RULES` 배열과 정렬된 배열의 삽입 순서를 따른다. `:61-98`은 severity·order·문자열 tie-breaker를 명시한다. | `Set`/`Map` 순회는 사용하지만 입력 순서가 고정되어 있다. 직접 1,152개를 두 번 비교한 결과 불일치 0건이었다. |
| A4 자기충족 테스트 여부 | 4 / 10 | 독립 기대값을 가진 스냅샷은 `app/src/lib/decision/__tests__/engine.snapshots.test.ts:34-205`에 있다. 그러나 UI 테스트 `app/src/components/__tests__/rule0-desk.ui.test.tsx:213-223`은 화면 제목 기대값을 `decideActions(state).actions.map(displayCardTitle)`로 만들고, `:244-270`은 금지·접힘 기대값을 다시 `decideActions`에서 만든다. | 이 UI 테스트들은 “현재 엔진 출력이 현재 UI에 복사되는가”만 검증한다. 엔진과 UI가 같은 방식으로 틀리면 통과하므로 계약상 카드 순서·문구의 독립 검증 가치는 0이다. 독립 스냅샷이 따로 있어 전 항목을 0점 처리하지는 않았다. |
| B1 `llms.txt` | 9 / 10 | `app/src/app/llms.txt/route.ts:9-46`은 명세 `docs/planning/11-spec-draft.md:332-341`의 8개 절을 같은 순서로 둔다. 데스크는 `:15`의 ``${origin}/`` 절대 URL이고, 미구현 `/room`·`/safety`·REST·MCP·평가는 `:16-22`, `:44`에서 모두 “현재 배포본 미제공”이라고 한다. | 가짜 엔드포인트는 없다. 다만 8절의 출처 목록(`:45`)은 실제 카드 레지스트리의 경찰청·대한민국 정책브리핑 출처(`app/src/lib/decision/sources.ts:56-61`)를 열거하지 않아 기계용 출처 인벤토리로는 불완전하다. |
| B2 시맨틱 마크업 | 7 / 10 | 행동은 `app/src/components/rule0-desk.tsx:434-470`의 `<section>`·`<h2>`·`<ol>` 안에 있고, 카드는 `app/src/components/action-card.tsx:281-314`의 `<article data-priority>`·`<h3>`, 전제는 `:301-311`의 `<ul>`, 출처는 `:361-377`의 별도 `<ul>`이다. 금지는 `app/src/components/prohibition-block.tsx:7-24`의 `<aside>`·`<ul>`이다. | 접힌 카드는 `app/src/components/next-steps.tsx:24-49`에서 순위·목적·전제·전화 링크만 렌더하고 `required_followup`, `official_sources`, `template_versions`를 구조적으로 버린다. 또한 쉬운 화면은 `rule0-desk.tsx:354-357`에서 카드 하나만 남기지만 `:453-469`의 `<ol>`/`<li>`에 `start`·`value`가 없어 2순위 카드를 보고 있어도 목록 의미는 첫 항목이 된다. |
| B3 상태·출처 라벨의 기계 판별 | 3 / 10 | 출처 enum은 `app/src/lib/contracts/types.ts:47-56`, 라벨은 `app/src/lib/ui/labels.ts:97-110`에서 `ui_event`→“자동 관측”, `user_statement`→“사용자 진술”로 분리되고, `app/src/components/event-history.tsx:109-117`에서 이벤트마다 배지를 표시한다. 그러나 카드 ID는 `app/src/lib/decision/engine.ts:195-210`에서 오직 ``action:${mergeKey}``이고, 이력은 `app/src/components/rule0-desk.tsx:359-361`의 **현재 결과 제목 맵**을 받아 `app/src/components/event-history.tsx:95-101`에서 과거 이벤트를 다시 라벨링한다. | enum·배지 자체는 정직하다. 하지만 동일 `action:call:112`가 상태 변경 전 “인증정보 노출 상황 상담”, 변경 후 “신고·지급정지 연계 요청”이 된다. 과거 `user_reported_requested`가 현재의 더 강한 요청에 대한 진술처럼 표시된다. 제목이 사라진 이벤트의 대체 문구도 “현재 화면의 행동”(`event-history.tsx:96`)이라 사실과 반대일 수 있다. |
| B4 권한 경계 전달 | 4 / 10 | `/llms.txt`는 `app/src/app/llms.txt/route.ts:9-12`에 “지급정지, 신고 접수, 수사·법적 판정을 수행하지 않음”을 둔다. 화면도 `app/src/components/trust-notice.tsx:11-13`에 같은 한계를 둔다. §4.1 타입에는 `app/src/lib/contracts/types.ts:74-92`의 `disclaimer`가 있다. 반면 실제 공개 엔진 결과는 `app/src/lib/decision/engine.ts:52-55`, `:494-503`처럼 `actions`와 `next_steps`만 반환한다. | 권한 한계가 기계가 재사용하는 `DecisionResult`에 없다. 에이전트가 엔진 결과만 import하면 화면 하단·`llms.txt`를 함께 읽어야 한다는 강제가 없고, “지급정지 요청”을 서비스가 수행한 결과로 과장할 수 있다. |
| C1 인용 무결성 | 7 / 10 | `app/src/lib/decision/sources.ts:1-63`의 6개 ID 모두 `institution`, `document_title`, HTTPS `url`, `reviewed_at`을 가진다. `:65-80`이 비어 있는 메타데이터를 거부하고, 전수 실행에서 누락 ID는 0건이었다. | 명세 R5·R7은 금융감독원 안내와 금융위원회 안내 두 출처를 요구한다(`docs/planning/11-spec-draft.md:430`, `:432`). 구현은 모든 R5·R7 행에 `["SRC-FSS-1332"]` 하나만 둔다(`app/src/lib/decision/rules.ts:245-266`, `:327-348`)며 금융위원회 1332 출처 ID 자체가 레지스트리에 없다. 존재성은 맞지만 계약상 출처 합집합은 불완전하다. |
| C2 고정 문구 경계 | 2 / 10 | 명세는 긴급 행동·연락처·법적 문구를 템플릿+슬롯으로 고정한다(`docs/planning/11-spec-draft.md:678-688`)며, 실제 시행일 미확인 시 템플릿 비활성을 요구한다(`:494-505`). 그러나 `app/src/lib/templates/registry.ts:35-44`, `:68-110`의 5개 템플릿은 `source_effective_date_confirmed: false`인데 활성 레지스트리에 있고, `:118-146`의 게이트는 이 플래그와 만료일을 검사하지 않는다. `app/src/lib/ui/labels.ts:164-171`은 조건 없이 본문을 꺼내며 `app/src/components/copy-script.tsx:32-36`은 이를 “승인된 고정 문구”라고 표시한다. | 레지스트리가 있어도 배포 차단 계약이 fail-open이다. 또 3일 문구는 `app/src/lib/decision/rules.ts:58-65`와 `app/src/lib/templates/registry.ts:57-66`에 중복되고, R3 통화 카드에는 그 문구를 `required_followup`으로 넣으면서 `template_versions`에는 서면 후속 버전이 아닌 `TPL-BANK-STOP-001@1.0`만 싣는다(`rules.ts:154-172`). 화면 연락처·법적 설명도 `action-card.tsx:63-104`, `event-history.tsx:53-61`, `evidence-panel.tsx:19-69`에서 별도 문자열 원본을 가진다. |
| C3 확률 오해 | 10 / 10 | `app/src/app/llms.txt/route.ts:24-27`은 “`evidence_strength`는 근거 충분도이며 확률·정확도·안전 보증이 아님”과 현재 판정 미제공을 함께 표시한다. 저장소 검색에서도 `evidence_strength`를 백분율·정확도로 렌더하는 경로를 찾지 못했다. | 현재 W1 화면에는 판정 자체가 없으며, 기계 안내는 비확률 의미를 명시한다. |
| C4 부분 인용 위험 | 3 / 10 | R3 통화 카드들은 3일 문구를 `required_followup`으로 반복해 부분 인용 위험을 일부 줄인다(`app/src/lib/decision/rules.ts:154-172`). 그러나 안전 기기 수정 대상은 `app/src/lib/decision/engine.ts:30-35`에서 `procedure:written_followup`을 제외하고, UI는 그 카드를 `app/src/components/action-card.tsx:77-82`에서 1394 전화 행동으로 만든다. 명세는 의심·미확인 기기의 **모든 통화·앱 행동 카드**에 안전 기기 전제를 요구한다(`docs/planning/11-spec-draft.md:393-395`). | `already_sent + remote_control`에서 필수 서면 후속 카드의 전제는 법적 적용 조건뿐이고 안전 기기 전제가 없다. 카드 간 `depends_on`·원자적 묶음도 없어서 에이전트가 이 카드만 잘라 “1394로 전화”를 중계하면 의심 기기에서 전화하게 만들 수 있다. 반복된 3일 문구에는 실제 문구 버전도 결합되지 않는다. |
| C5 `next_steps` 무손실 | 7 / 10 | `app/src/lib/decision/engine.ts:422-465`는 비선택 카드를 `next`에 넣고 전체 연속 priority를 부여하며, `:484-491`은 `next_steps`를 별도 직렬화한다. 전수 테스트 `app/src/lib/decision/__tests__/engine.exhaustive.test.ts:270-294`는 merge key·목적·출처·버전 합집합을 독립 재계산한다. 직접 실행에서 최대 5개의 `next_steps`가 나왔고 소실은 없었다. | 내부 객체는 보존된다. 하지만 `actions`만 읽으면 최대 5개 행동을 놓칠 수 있고, 응답에는 `has_more`·`total_action_count` 같은 강제 신호가 없다. 렌더된 `next_steps`는 B2에서 본 것처럼 출처·후속·버전을 표시하지 않아 페이지 소비자는 완전한 객체를 복원할 수 없다. |
| D1 프레임워크 독립성 | 5 / 10 | `app/src/lib/decision/engine.ts:1-20`의 의존은 타입과 같은 `lib/decision` 모듈뿐이며 React·Next import는 없다. 그러나 `app/tsconfig.json:8-12`, `:21-23`은 `noEmit`, `moduleResolution: "bundler"`, `@/*` alias를 전제로 하고 `app/package.json:1-4`는 private 앱이며 라이브러리 `exports`가 없다. | 코어 계산은 프레임워크 독립적이지만 배포 가능한 Node 모듈은 아니다. `node -e "import('./app/src/lib/decision/engine.ts')"` 실측은 확장자 없는 `./prohibitions`에서 `ERR_MODULE_NOT_FOUND`로 실패했다. Vite/Vitest 로더가 있어야 호출된다. |
| D2 버전 식별 | 4 / 10 | 카드에는 `template_versions`와 `rule_ids`가 있다(`app/src/lib/contracts/types.ts:59-72`). 레지스트리에는 `source_reviewed_at`, `next_review_at`이 있다(`app/src/lib/templates/types.ts:10-19`). | 출력에는 ruleset/engine 버전, 규칙 검수일, 출처 검수일, 기준 시각이 없다. `R3` 같은 ID는 버전이 아니며, 같은 ID의 구현이 바뀌어도 소비자가 구분할 수 없다. 따라서 에이전트가 “언제 기준 안내인지”를 카드 결과만으로 말할 수 없다. |
| D3 오류 계약 | 1 / 10 | `app/src/lib/decision/engine.ts:494-503`은 입력 검증 없이 바로 규칙 수집을 시작한다. 전수 테스트 입력도 `app/src/lib/decision/__tests__/engine.exhaustive.test.ts:18-35`의 유효 enum만 생성하며 비정상 입력 테스트가 없다. §6.3은 스키마·열거형 검증을 첫 단계로 요구한다(`docs/planning/11-spec-draft.md:694-704`). | 직접 실행에서 `transfer_state` 누락 객체와 모든 값이 범위 밖인 객체가 모두 예외 없이 `{actions:[], next_steps:[]}`를 반환했다. `{transfer_state:"already_sent"}`만 주면 다른 축을 미확인으로 질문하지 않고 지급정지·112·서면 후속 카드를 반환하며 안전 기기 전제도 빠진다. 조용한 오안내다. |

### 직접 실행 확인 기록

코드 수정 없이 Vite의 SSR 로더로 실제 모듈을 불러 다음을 확인했다.

```text
유효 도메인 전수:
{"count":1152,"thrown":0,"determinism_mismatches":0,"missing_source_refs":0,"max_next_steps":5}

비정상 입력:
missing_transfer -> {"actions":[],"next_steps":[]}
invalid_all     -> {"actions":[],"next_steps":[]}

같은 이벤트 ID 의미 변화:
not_sent    -> {"id":"action:call:112","title":"112에 인증정보 노출 상황 상담"}
already_sent-> {"id":"action:call:112","title":"112 신고·지급정지 연계 요청"}

already_sent + remote_control의 procedure:written_followup:
priority=4
prerequisite=["긴급·부득이한 사유로 전화·구술로 피해구제를 신청한 경우"]
// "의심 기기와 분리된 안전한 기기에서 실행" 없음

일반 Node 직접 import:
ERR_MODULE_NOT_FOUND: .../app/src/lib/decision/prohibitions
```

## 3. 오중계 시나리오

### 시나리오 1 — 과거 “상담 요청”이 현재 “지급정지 요청”으로 바뀐다

- **입력 상태:** 처음에는 `credential_exposure_state=shared`, `transfer_state=not_sent`다. 사용자가 `action:call:112`에서 “요청을 전달했어요”를 선택한다.
- **에이전트가 읽는 것:** 이벤트는 `action_id`, 상태, 출처만 보존한다(`app/src/lib/contracts/types.ts:48-56`). 이후 `transfer_state=already_sent`로 바꾸면 같은 ID의 현재 제목이 “112 신고·지급정지 연계 요청”으로 바뀌고(`app/src/lib/decision/engine.ts:200-215`), 이력 화면은 현재 제목 맵으로 과거 이벤트를 표시한다(`app/src/components/rule0-desk.tsx:359-361`, `event-history.tsx:95-101`).
- **잘못된 중계:** “사용자가 112에 지급정지 연계 요청을 이미 전달했습니다.”
- **사용자 피해:** 실제로는 인증정보 노출 상담만 했는데 지급정지 연계까지 끝난 것으로 믿어 재연락을 미룬다.
- **구조적 수정안:** `ActionCard.id`를 `merge_key`만으로 만들지 말고 `merge_key + 정렬된 purpose_slots + template_versions`의 불변 semantic ID로 만든다. 로컬 세션에는 이벤트 발생 당시의 승인된 `title/purpose_slots/template_versions` 스냅샷을 ID별 카탈로그로 보존한다. 상태 변경 후에도 이력은 현재 카드가 아니라 이 불변 카탈로그로 렌더하고, 이 전환 회귀 테스트를 추가한다.

### 시나리오 2 — 의심 기기에서 1394로 전화하라고 중계한다

- **입력 상태:** `transfer_state=already_sent`, `device_compromise_state=remote_control`, `safe_device_available=yes`.
- **에이전트가 읽는 것:** 서면 후속 카드는 4순위로 남지만 안전 기기 수정 대상 목록에서 빠져 있다(`app/src/lib/decision/engine.ts:30-35`, `:345-372`). 화면은 이 카드를 1394 전화 링크로 렌더한다(`app/src/components/action-card.tsx:77-82`).
- **잘못된 중계:** 4번 카드만 발췌해 “이 전화에서 1394로 연락하세요”라고 말하면서 안전 기기 전제를 누락한다.
- **사용자 피해:** 원격제어 중인 기기에서 통화·검색을 이어가 사기범이 대응을 방해하거나 추가 정보를 보게 할 수 있다.
- **구조적 수정안:** `procedure:written_followup`을 전화 행동으로 렌더하는 한 `SAFE_DEVICE_ACTION_KEYS`에 포함한다. 더 안전하게는 “서면 제출 절차”와 “1394 상담”을 별도 의미 ID로 분리하되 명세의 merge key 변경 승인을 먼저 받는다. 렌더된 모든 `tel:` 행동이 의심·미확인 기기 상태에서 안전 기기 전제를 갖는지 전수 테스트한다.

### 시나리오 3 — 잘못된 JSON을 “조치 없음”으로 해석한다

- **입력 상태:** 다른 에이전트가 `transfer_state`를 누락하거나 `"sent"`처럼 계약 밖 값으로 전달한다.
- **에이전트가 읽는 것:** `decideActions`는 검증하지 않고 모든 비교를 false로 통과시켜 빈 배열을 반환한다(`app/src/lib/decision/engine.ts:494-503`, 규칙 비교는 `app/src/lib/decision/rules.ts:69-353`).
- **잘못된 중계:** “현재 필요한 공식 행동이 없습니다.”
- **사용자 피해:** 이미 송금한 사용자가 금융회사 연락과 112 신고를 지연한다. 반대로 `{transfer_state:"already_sent"}`만 전달하면 누락된 기기 상태를 `unknown`으로 다루지 않아 안전 기기 전제가 없는 조치를 받는다.
- **구조적 수정안:** 엔진 공개 경계에서 6개 필수 키와 정확한 enum을 런타임 스키마로 검사한다. 실패 시 빈 카드가 아니라 안정적인 `INVALID_INCIDENT_STATE` 오류를 입력 비반사 방식으로 반환한다. 누락·추가·오타·`null`·배열 입력에 대한 실패 테스트를 추가한다.

### 시나리오 4 — 미확인 템플릿을 “승인된 최신 안내”로 중계한다

- **입력 상태:** 앱 설치 또는 인증정보 노출 상태라서 `TPL-SAFE-DEVICE-001@1.0` 또는 `TPL-CREDENTIAL-RECOVERY-001@1.0`이 선택된다.
- **에이전트가 읽는 것:** 레지스트리는 `source_effective_date_confirmed:false`를 명시하지만(`app/src/lib/templates/registry.ts:35-44`, `:68-77`), UI는 게이트 없이 본문을 꺼내 “승인된 고정 문구”라고 표시한다(`app/src/lib/ui/labels.ts:164-171`, `app/src/components/copy-script.tsx:32-36`).
- **잘못된 중계:** “시행일과 최신성이 검증된 공식 승인 문구입니다.”
- **사용자 피해:** 검수 완료·시행일 확인·현재 유효성을 혼동해 오래되거나 적용 범위가 불명확한 안내를 권위 있게 따른다.
- **구조적 수정안:** 템플릿 상태를 `active/inactive/expired`로 명시하고, `source_effective_date_confirmed=false` 또는 `next_review_at` 경과 시 registry resolve 자체를 실패시킨다. UI·엔진·빌드가 같은 resolver를 사용하고 “승인” 배지는 active 템플릿에만 허용한다.

### 시나리오 5 — 엔진 결과를 서비스의 처리 결과로 말한다

- **입력 상태:** `transfer_state=already_sent`.
- **에이전트가 읽는 것:** `decideActions` 결과에는 “지급정지 요청”, “112 신고·지급정지 연계 요청” 카드만 있고 서비스 권한 한계는 없다(`app/src/lib/decision/engine.ts:52-55`, `:494-503`). 한계 문구는 별도 `/llms.txt`와 화면 footer에만 있다.
- **잘못된 중계:** “골든타임이 지급정지와 신고 접수를 진행했습니다.”
- **사용자 피해:** 사용자가 실제 금융회사·경찰 연락을 하지 않고 처리되었다고 오신한다.
- **구조적 수정안:** 에이전트용 공개 직렬화 결과를 §4.1 `AnalyzeResponse` envelope로만 제공하고, 계약에 이미 있는 고정 `disclaimer`를 실제 응답 객체에 필수로 결합한다. 내부 `DecisionResult`의 직접 외부 export는 비공개로 제한하거나 이름을 `DecisionPlan`으로 바꿔 처리 결과가 아님을 드러낸다.

## 4. 치명적 결함(Blocker)

| 무엇이 | 어디에 | 계약 조항 | 구체적 수정 지시 |
|---|---|---|---|
| 행동 이벤트의 의미가 상태 변경 뒤 재라벨링됨 | `app/src/lib/decision/engine.ts:195-210`; `app/src/components/rule0-desk.tsx:359-361`; `app/src/components/event-history.tsx:95-101` | §4.6 `docs/planning/11-spec-draft.md:466-474`; NF-12 `:739-740` | 이벤트가 참조하는 행동 ID를 의미 불변 ID로 바꾸고 당시 카드 의미를 로컬 카탈로그에 스냅샷한다. 과거 이벤트를 현재 제목으로 join하지 않는다. credential 상담→송금 완료 전환 회귀 테스트를 release gate에 추가한다. |
| 비정상·부분 입력을 조용히 카드 또는 빈 배열로 변환 | `app/src/lib/decision/engine.ts:494-503`; 유효 입력만 만드는 테스트 `app/src/lib/decision/__tests__/engine.exhaustive.test.ts:18-35` | §4.4 `docs/planning/11-spec-draft.md:343-352`; §6.3 `:694-704`; §9.3 `:777-785` | `decideActions` 진입 전에 정확한 6개 키·enum을 런타임 검증한다. 실패 시 비반사 `INVALID_INCIDENT_STATE`로 명확히 거부하고 빈 행동을 정상 결과로 반환하지 않는다. |
| 1394 전화 행동과 안전 기기 전제가 분리 | `app/src/lib/decision/engine.ts:30-35`, `:345-372`; `app/src/components/action-card.tsx:77-82` | §4.5.1⑤ `docs/planning/11-spec-draft.md:389-397`; §6.2 `:685-687` | `procedure:written_followup`을 전화 행동으로 렌더하는 모든 경로에 안전 기기 modifier를 적용한다. `tel:` 렌더 결과와 `prerequisite`의 교차 계층 전수 테스트를 추가한다. |
| 미확인 템플릿이 활성·“승인” 표시되고 법적 문구 버전이 카드에 잘못 귀속 | `app/src/lib/templates/registry.ts:35-44`, `:68-110`, `:118-146`; `app/src/lib/decision/rules.ts:154-172`; `app/src/components/copy-script.tsx:32-36` | §4.7 `docs/planning/11-spec-draft.md:494-511`; §6.2 `:678-688`; NF-13 `:739-740`; §9.10 `:806-808` | 미확인/만료 템플릿은 resolve·빌드·노출을 모두 차단한다. 고정 문구를 rules/component에서 제거하고 registry의 구조화 슬롯만 사용한다. 모든 `required_followup` 항목에 `template_version`을 직접 결합해 문구와 버전이 분리되지 않게 한다. |
| 권한 한계가 기계 결과에서 탈락 | `app/src/lib/contracts/types.ts:74-92`에는 `disclaimer`가 있으나 `app/src/lib/decision/engine.ts:52-55`, `:494-503` 결과에는 없음 | §1.1 `docs/planning/11-spec-draft.md:21-27`; §4.1 `:284-302`; §4.3 `:323-330` | 재사용·중계 표면은 고정 disclaimer가 포함된 `AnalyzeResponse`만 반환한다. “실제 처리하지 않음”을 UI 장식이 아니라 직렬화 필수값 및 계약 테스트로 만든다. |

## 5. 개선 권고

| 우선순위 | 권고 | 완료 기준 |
|---|---|---|
| P0 | 위 Blocker 5건을 먼저 해결한다. | 상태 전환 이력, invalid input, 모든 전화 행동 안전 전제, template activation, disclaimer envelope가 독립 기대값 테스트를 통과한다. |
| P1 | R5·R7의 금융위원회 1332 출처를 별도 `SourceId`로 추가하고 명세의 두 출처 합집합을 보존한다. | `docs/planning/11-spec-draft.md:430`, `:432`의 두 URL이 각 관련 카드 `official_sources`에 모두 나타난다. |
| P1 | 접힌 카드의 기계 표현을 노출 카드와 동형으로 만든다. | `NextSteps`가 `required_followup`, `official_sources`, `template_versions`, 금지 행동을 구조적으로 렌더하고, 에이전트 문서와 계약 테스트가 항상 `actions + next_steps`를 함께 소비하도록 강제한다. 별도 개수 필드가 필요하면 먼저 §4.1 계약을 개정한다. |
| P1 | 독립 계약 fixture로 UI 인수 테스트를 바꾼다. | `rule0-desk.ui.test.tsx`의 기대 카드·금지·접힘 값을 `decideActions` 호출로 만들지 않고 §4.5.4 고정 fixture에서 읽는다. |
| P1 | §4.1 계약 개정 승인을 거쳐 규칙 세트 버전을 출력에 추가한다. | 모든 결과에 불변 `ruleset_version`, `generated_at`, 출처·템플릿 검수 기준을 싣고 같은 버전의 재현 테스트가 가능하다. |
| P2 | Node 소비용 ESM 패키지 진입점을 만든다. | 빌드된 `.js`와 `.d.ts`, 확장자 있는 import, `package.json exports`를 제공하고 `node -e import(...)`만으로 `decideActions` 또는 안전 envelope 함수를 호출할 수 있다. |
| P2 | 쉬운 화면의 목록 순위를 HTML 의미와 맞춘다. | 한 카드만 렌더할 때 `<ol start={card.priority}>` 또는 `<li value={card.priority}>`를 사용해 DOM 순위와 `data-priority`가 일치한다. |
| P2 | 레지스트리 lookup을 fail-closed로 바꾼다. | 알 수 없는 source/template ID가 들어오면 UI가 조용히 생략하지 않고 QA 오류로 카드 노출을 차단한다. |
| P2 | `/llms.txt` 8절의 출처 인벤토리를 실제 레지스트리와 자동 생성·대조한다. | `SRC-KOREA-1394`를 포함한 활성 출처 기관·최종 검수일이 누락 없이 나오고 미제공 endpoint는 계속 명시적으로 미제공 상태다. |

## 6. 잘한 점

1. **§4.1 타입 복제가 정확하다.** `app/src/lib/contracts/types.ts:1-92`는 필드명과 union을 명세 그대로 옮겼고, 내부 렌더 필드와 외부 직렬화 필드를 `app/src/lib/decision/engine.ts:43-50`, `:467-491`에서 분리했다.
2. **유효 상태 도메인의 전수 테스트는 실제 전수다.** `app/src/lib/decision/__tests__/engine.exhaustive.test.ts:18-35`의 곱은 정확히 1,152개이고 각 속성 묶음이 전부 순회한다. 직접 실행에서도 예외·결정론 불일치가 0이었다.
3. **`next_steps`는 엔진 객체에서 소실되지 않는다.** `app/src/lib/decision/engine.ts:422-465`가 노출과 접힘을 명시적으로 나누고 연속 priority를 부여하며, `:484-491`이 두 배열을 모두 직렬화한다.
4. **자동 관측과 사용자 진술의 원시 enum 및 배지는 명확하다.** `app/src/lib/events/action-fact.ts:40-50`이 상태별 허용 출처를 강제하고, `app/src/components/event-history.tsx:109-117`이 각 이벤트의 출처를 표시한다. B3의 감점은 이 좋은 분리가 아니라 행동 의미 join의 결함 때문이다.
5. **출처 ID는 현재 결과에서 유실·환각되지 않는다.** `app/src/lib/decision/sources.ts:20-63`에 현행 모든 ID의 기관·문서명·URL이 있고, 전수 실행의 missing source ref는 0이었다.
6. **`evidence_strength`의 비확률 경계가 기계 문서에 정확하다.** `app/src/app/llms.txt/route.ts:24-27`은 근거 충분도와 확률·정확도·안전 보증을 명시적으로 분리한다.
7. **미구현 표면을 있는 것처럼 광고하지 않는다.** `app/src/app/llms.txt/route.ts:14-22`, `:35-37`, `:43-46`은 `/room`, `/safety`, REST, MCP, 평가를 모두 현재 미제공으로 표시한다.
8. **기본 페이지 구조는 div 수프가 아니다.** 행동 순서는 `<ol>`, 개별 행동은 `<article>`, 금지는 `<aside>`, 출처와 전제는 별도 목록으로 구분된다(`app/src/components/rule0-desk.tsx:434-470`, `app/src/components/action-card.tsx:281-377`, `app/src/components/prohibition-block.tsx:7-24`).
