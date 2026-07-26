# W-B UI Blocker 수정 보고서

- 기준일: 2026-07-25
- 작업 범위: UI·브라우저 세션 의미 카탈로그·UI 회귀 테스트·`/llms.txt`
- 계약 기준: `docs/planning/22-revision-plan-r6.md` I2~I4,
  `docs/planning/11-spec-draft.md` §2.2·§4.5.3·§4.6·§4.7
- 결과: B1~B7 해결, `cd app && npm run verify` exit 0,
  프로덕션 서버 실측 통과
- 동결 경계: `app/src/lib/**`, §4.1 타입, `ActionFactState`,
  `merge_key` 어휘를 변경하지 않았다.

## B1 `procedure:written_followup` 1차 행동 정정

수정 위치:

- `app/src/components/action-card.tsx:48-52`
  - `PHONE_KEYS`에서 `procedure:written_followup`을 제외했다.
- `app/src/components/action-card.tsx:86-101`
  - 1차 행동을 “피해구제신청서 제출 방법 확인”으로 바꾸고
    `SRC-EASYLAW-STOPPAY`의 공식 안내를 새 탭으로 연다.
  - 1394는 외곽선 스타일의 “1394에 절차 상담하기” 2차 행동으로 내렸다.
  - 1394 링크에는 `onRecord`를 연결하지 않아 다이얼러 열기를 서면 제출
    카드의 현재 상태로 환원하지 않는다.
- `app/src/components/action-card.tsx:174-181`
  - `user_reported_requested` 화면 라벨을
    “피해구제신청서를 금융회사에 제출했다고 확인했어요”로 분기했다.
- `app/src/components/next-steps.tsx:29-46`
  - 같은 카드가 접힌 표현 경로에 들어가도 1차 제출 안내·2차 1394 순서를
    동일하게 유지한다.

회귀 테스트:

- `app/src/components/__tests__/ui-blockers.ui.test.tsx:82-132`
  - 1차 링크 URL·새 탭, 2차 `tel:1394`·외곽선 스타일, 1394 클릭 시
    상태 기록 없음, 서면 제출 확인 라벨을 검사한다.

판단 근거:

- r6 I2의 “금융회사에 피해구제신청서 제출 → 이어서 1394 절차 상담”
  순서를 그대로 UI 행동 우선순위로 옮겼다.
- `ActionFactState` 열거값을 늘리지 않고 행동별 화면 라벨만 분기했다.

## B2 모든 `tel:` 카드의 안전 기기 전제

수정 위치:

- `app/src/components/action-card.tsx:66-101,148-153`
  - `call:112`, `call:1332`, 서면 후속 카드의 1394 링크 바로 앞에
    위험·미확인 기기용 안전 기기 안내를 렌더한다.
- `app/src/components/next-steps.tsx:29-69`
  - 접힌 카드의 모든 전화 링크에도 같은 안내를 렌더한다.

선택한 처리:

- 1394 버튼을 숨기지 않고, `device_compromise_state`가
  `suspected_app`, `remote_control`, `unknown`이면 버튼과 같은 카드에
  “전화 상담은 의심 기기와 분리된 안전한 기기에서 하세요.”를 명시했다.
- 1394는 피해상담·관계기관 연계에 유용한 공식 2차 채널이므로 제거보다
  안전 기기 조건을 행동 바로 옆에 고정하는 편이 계약 순서와 정보 보존을
  함께 만족한다고 판단했다.

회귀 테스트:

- `app/src/components/__tests__/ui-blockers.ui.test.tsx:135-221`
  - 6개 상태 축의 1,152개 조합을 전부 결정 엔진에 통과시킨 뒤 실제
    `ActionCardView`와 `NextSteps`를 정적 렌더한다.
  - 위험·미확인 기기 상태에서 렌더된 모든 `a[href^="tel:"]`의 동일 카드
    안에 `data-safe-device-call="true"` 안내가 있는지 검사한다.
  - 검사 조합 1,152개, 위반 0건이다.

## B3 행동 이벤트 이력 재라벨링 차단

수정 위치:

- `app/src/components/action-meaning-catalog.ts:4-130`
  - 별도 버전형 `sessionStorage` 키에 이벤트 ID별
    `{title, purpose_slots, template_versions}` 의미 카탈로그를 저장한다.
  - 저장 payload는 위 세 필드만 허용하며, 잘못된 저장값은 빈 카탈로그로
    fail-closed 처리한다.
- `app/src/components/rule0-desk.tsx:63-66,120-124`
  - 이벤트와 의미 카탈로그를 하나의 UI 결합 상태로 묶어 함께 갱신한다.
- `app/src/components/rule0-desk.tsx:143-184`
  - 기존 이벤트와 의미 카탈로그를 세션에서 각각 복구·저장한다.
- `app/src/components/rule0-desk.tsx:201-227,296-344`
  - 자동 관측과 사용자 진술 이벤트를 추가할 때 그 시점 카드 의미를 같은
    이벤트 ID에 원자적으로 보존한다.
- `app/src/components/rule0-desk.tsx:346-369`
  - 정정 이벤트는 정정 대상의 보존 의미를 복사한다.
- `app/src/components/event-history.tsx:95-100`
  - 이력 제목은 현재 결과가 아니라 이벤트 ID 카탈로그에서만 읽는다.
    없으면 “기록 당시 행동(제목 미보존)”으로 불확실성을 표시한다.

회귀 테스트:

- `app/src/components/__tests__/rule0-desk.ui.test.tsx:474-551`
  - `credential=shared, transfer=not_sent`에서 112 요청 진술을 기록한 뒤
    `transfer=already_sent`로 바꾸고, 이력과 세션 카탈로그에 기록 당시
    “112에 인증정보 노출 상황 상담” 제목·목적·버전이 유지되는지 검사한다.
- `app/src/components/__tests__/evidence-panel.ui.test.tsx:62-89`
  - 카탈로그가 없는 과거 이벤트가 현재 카드 제목으로 재라벨링되지 않고
    명시적 불확실성 문구를 쓰는지 검사한다.

판단 근거:

- 동결된 `ActionFactEvent`를 변경하지 않고 UI 세션 저장 계층을 별도 키로
  확장했다. 이벤트 ID를 카탈로그 키로 사용해 같은 `action_id`의 의미가
  이후 상태에서 바뀌어도 과거 진술과 결합되지 않는다.

## B4 템플릿 게이트 UI 연결

수정 위치:

- `app/src/app/page.tsx:10,26-30`
  - 서버 컴포넌트 경계에서 기준일 `2026-07-25`를 명시적으로 주입한다.
- `app/src/components/rule0-desk.tsx:58-61,109-112,514-523`
  - 기준일을 테스트 가능한 prop으로 받아 각 행동 카드에 전달한다.
- `app/src/components/action-card.tsx:14-17,294-307`
  - `TEMPLATE_REGISTRY` 직접 본문 조회를 제거하고 각 버전을
    `resolveTemplate(version, referenceDate)`로만 해석한다.
- `app/src/components/action-card.tsx:396-421`
  - `unconfirmed`·`expired` 본문과 “승인된 고정 문구” 배지를 숨기고
    사용자용 상태·차단 이유를 표시한다.
- `app/src/components/action-card.tsx:423-445`
  - active 본문만 복사 블록에 전달하며 카드·긴급 행동·안내 문구 버전은
    계속 보존한다.

회귀 테스트:

- `app/src/components/__tests__/ui-blockers.ui.test.tsx:224-293`
  - unconfirmed와 expired 각각에서 본문·승인 배지가 없고 이유가 보이며,
    카드와 버전 표기는 남는지 검사한다.

판단 근거:

- 기준일은 resolver 외부에서 결정하며 엔진이나 UI가 현재 시각을 생성하지
  않는다. 여러 템플릿이 병합된 카드는 active 본문만 복사 가능하고 차단된
  상태는 별도로 표시한다.

## B5 미구현 기능 암시 제거

수정 위치:

- `app/src/components/rule0-desk.tsx:435-440`
  - 상단 배지를 “구조화 상태 선택 데모”로 교체했다.
- `app/src/app/llms.txt/route.ts:29-33`
  - 현재 데스크를 “구조화 상태 선택 데모만 제공”으로 정정하고 자유 입력
    가림 경로는 계속 “현재 배포본 미제공”으로 표시한다.

회귀 테스트:

- `app/src/components/__tests__/ui-blockers.ui.test.tsx:296-308`
  - 화면 배지의 정직한 표기를 검사한다.
- `app/src/app/llms.txt/__tests__/route.test.ts:6-19`
  - 실제 route 응답에 “합성 샘플”이 없고 구조화 데모·미제공 경계가 있는지
    검사한다.

판단 근거:

- F-01이나 `scenario_id` 선택은 추가하지 않았다. 현재 구현된 구조화 상태
  선택만 기술해 §2.2의 미구현 기능 암시 금지를 지켰다.

## B6 접힌 카드 표현 동형화

수정 위치:

- `app/src/components/next-steps.tsx:74-94`
  - 모든 필드를 구조적으로 나타내는 공통 `CardField`를 사용한다.
- `app/src/components/next-steps.tsx:109-184`
  - 카드 ID·priority·제목·`purpose_slots`·`prerequisite`·
    `required_followup`·`official_sources`·`do_not_show_when`·
    `prohibited_actions`·`template_versions`를 마크업에 보존한다.
  - 템플릿 버전과 내부 행동 분류는 “왜 이 순서인가” 접이식 안에서만
    표시한다.
- `app/src/components/next-steps.tsx:29-69`
  - 접힌 카드도 노출 카드와 같은 1차/2차 행동 및 안전 기기 조건을 쓴다.

회귀 테스트:

- `app/src/components/__tests__/ui-blockers.ui.test.tsx:311-368`
  - 서면 후속 카드를 접힌 카드로 직접 렌더해 후속·출처·버전·금지 필드,
    1차 제출 링크, 2차 1394, 안전 기기 안내를 모두 검사한다.

판단 근거:

- §4.1 스키마와 `has_more` 같은 새 필드를 추가하지 않았다. `<details>`가
  닫혀 있어도 자식 마크업은 문서에 존재하므로 페이지 소비자가 완전한
  카드 필드를 복원할 수 있다.

## B7 UI 인수 테스트 자기충족 제거

수정 위치:

- `app/src/components/__tests__/rule0-desk.ui.test.tsx:16`
  - `DECISION_SNAPSHOT_FIXTURES`를 직접 import한다.
- `app/src/components/__tests__/rule0-desk.ui.test.tsx:166-206`
  - a·b·c 카드 제목 순서를 테스트 내부 리터럴 계약으로 고정한다.
- `app/src/components/__tests__/rule0-desk.ui.test.tsx:208-239`
  - fixture의 상태·금지 목록·접힘 키 개수와 리터럴 제목을 화면 결과에
    대조한다.

회귀 테스트:

- 위 a·b·c parameterized 테스트 자체가 B7 회귀 게이트다.
- `rule0-desk.ui.test.tsx`에는 `decideActions` import·호출이 0건이다.

판단 근거:

- 입력 상태·금지 목록·접힘 개수는 독립 엔진 픽스처에서, 사용자에게
  보이는 제목은 테스트 리터럴에서 가져온다. UI와 기대값이 같은 엔진
  호출을 공유하지 않는다.

## 전체 검증

실행:

```text
cd app && npm run verify
exit 0
typecheck PASS
lint PASS
test: 19 files, 83 tests PASS
production build PASS
```

추가 정적 확인:

```text
git diff -- app/src/lib
출력 없음

git diff --check
출력 없음

app/src 금지 문자열 검색
위반 0건
```

## 프로덕션 서버 직접 확인

실행 순서:

```text
cd app
npm run build
PORT=3941 npm run start
sleep 6
curl -s http://localhost:3941/ | grep -c 'href="tel:"'
0
curl -s http://localhost:3941/ -o /dev/null -w "%{http_code}\n"
200
curl -s http://localhost:3941/llms.txt | grep -ci "합성 샘플"
0
```

- Next.js 16.2.11 프로덕션 서버가 `http://localhost:3941`에서 Ready인
  상태로 측정했다.
- 두 `grep -c`는 일치 항목이 없어 표준 grep 종료값 1을 반환하지만,
  요구한 출력값은 각각 0이다.
- 확인 뒤 `Ctrl-C`로 서버를 종료했고 포트 3941의 LISTEN 프로세스가
  없음을 확인했다.

## 미해결 항목

없음. B1~B7과 요구된 프로덕션 실측을 모두 완료했다.
