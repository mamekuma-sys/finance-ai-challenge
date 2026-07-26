# W1C 프로덕션 결함 수정 보고서

검증일: 2026-07-25

## 범위

프로덕션 서버와 실제 브라우저에서 확인된 UI 결함 5건만 수정했다. 조치 결정 엔진,
고정 템플릿, 행동 이벤트, 계약 로직·타입은 변경하지 않았다.

## 결함별 수정과 회귀 확인

| 결함 | 수정 위치 | 회귀 테스트 | 프로덕션 확인 |
|---|---|---|---|
| 1. 빈 `tel:` 링크 | `src/components/action-card.tsx:92` — 금융회사 카드는 FINE 공식 번호 찾기와 고정 주의 문구만 표시하고 빈 다이얼러 링크를 제거했다. `tel:112`·`tel:1394`는 `src/components/action-card.tsx:63`, `src/components/action-card.tsx:77`에 유지했다. | `src/components/__tests__/rule0-desk.ui.test.tsx:284` — 문서 전체의 `a[href="tel:"]`가 0개이고 FINE의 새 탭 속성, 고정 문구, 112·1394 링크가 유지되는지 검증한다. 같은 파일 `:404`의 행동 이력 테스트는 FINE 클릭 뒤 `dialer_opened`가 생기지 않고 실제 112 전화 링크에서만 생기는지 검증한다. | 빈 `tel:` 0개, FINE `target="_blank"`·`rel="noopener noreferrer"`, 112·1394 링크 각 1개, FINE 클릭 뒤 전화 앱 열기 기록 없음. |
| 2. 질문 카드에서 바로 답할 수 없음 | `src/components/state-editor.tsx:21` — 상태 라디오를 재사용 가능한 단일 필드셋으로 분리했다. `src/components/action-card.tsx:217`과 `:314` — `question_axes` 순서의 질문만 카드 안에 렌더하고 질문 카드의 전화 목적·주요 행동 체크·전화 문구 복사·전화 진행 상태를 숨겼다. `src/components/rule0-desk.tsx:456` — 카드와 하단 편집기에 같은 `incidentState`와 갱신 함수를 전달한다. | `src/components/__tests__/rule0-desk.ui.test.tsx:329` — 카드 안의 기기 질문에 답하면 1순위 카드가 즉시 재구성되고 하단 `아는 만큼만 알려주세요`의 같은 라디오도 선택되는지 검증한다. | 질문 축 3개만 카드 안에 표시됨. 기기 질문 응답 뒤 1순위가 금융회사 대표번호 행동으로 바뀌고 하단 기기 상태가 함께 선택됨. |
| 3. 질문 카드 내부 표현 노출 | `src/lib/ui/labels.ts:112` — 질문 카드 표시 제목을 `먼저 확인할 것`으로 변환한다. 이 표시 함수를 행동 카드, 접힌 행동, 비교 화면, 행동 이력에서 공통 사용한다. `src/components/action-card.tsx:317` — `먼저 3가지만 확인할게요.`와 실제 사용자 질문을 표시한다. | `src/components/__tests__/rule0-desk.ui.test.tsx:383` — 사용자 제목·확인 개수를 확인하고 내부 질문 제목·목적 문구가 표면에 없음을 검증한다. | 브라우저의 현재 보이는 텍스트에 `미확인 상태`, `상태 확인 질문` 없음. 질문 카드에 전화 목적, 전화 문구, 복사 제어도 없음. |
| 4. 상단 여백 과다 | `src/app/globals.css:424` — 일반 후속 섹션과 행동 섹션의 간격을 분리하고 기본 행동 섹션을 `clamp(24px, 3vw, 36px)`로 줄였다. `src/app/globals.css:1410` — 고령자 모드는 기존 `clamp(52px, 8vw, 88px)` 간격을 유지한다. `src/components/rule0-desk.tsx:426` — 내용 없는 오류 행이 공간을 차지하지 않게 했다. | `src/lib/accessibility/__tests__/easy-mode-css.test.ts:21` — 기본 화면 간격 축소와 고령자 모드 간격 보존을 함께 고정한다. | 1280×900 브라우저에서 기본 간격 36px, 고령자 모드 88px로 측정됨. |
| 5. 접힌 1332 카드에 전화 수단 없음 | `src/components/next-steps.tsx:8` — 접힌 `call:112`, `call:1332`, 1394 후속 카드에 각각 `tel:112`, `tel:1332`, `tel:1394` 링크를 렌더한다. | `src/components/__tests__/rule0-desk.ui.test.tsx:305` — 엔진 결과에 접힌 `call:1332`가 있는 상태에서 `a[href="tel:1332"]`가 1개 이상인지 검증한다. | 접힌 행동 유지 및 `tel:1332` 링크 1개 확인. |

## 전체 검증 결과

### 자동 검증

`cd app && npm run verify`

- exit 0
- typecheck 통과
- lint 통과
- 테스트 파일 14개, 테스트 60개 전부 통과
- Next.js 프로덕션 빌드 통과

### 프로덕션 서버

`PORT=3939 npm run start`로 빌드 결과를 실행했다.

- `curl -s http://localhost:3939/ -o /dev/null -w "%{http_code}\n"` → `200`
- `curl -s http://localhost:3939/ | grep -c 'href="tel:"'` → `0`

확인 뒤 서버를 종료했다.

### 실제 브라우저 CDP

`scripts/w1c-cdp-check.mjs`를 실제 Chromium headless shell의 원격 디버깅 포트에
연결해 1280×900 뷰포트에서 실행했다.

- 스크립트 exit 0, `failures: []`
- FINE 링크 속성·고정 문구와 `dialer_opened` 비기록 확인
- 질문 카드 3축, 전화용 UI 비노출, 응답 직후 카드 재구성과 하단 상태 동기화 확인
- 보이는 내부 질문 표현 0건 확인
- 기본/고령자 간격 36px/88px 확인
- 접힌 `tel:1332` 확인

확인 뒤 브라우저를 종료했다.

## 제약 확인

- `src/lib/decision/**`, `src/lib/templates/**`, `src/lib/events/**`,
  `src/lib/contracts/**` 변경 없음
- 기존 금지 문자열 게이트 포함 전체 테스트 통과
- 외부 링크는 기존 허용 도메인인 `fine.fss.or.kr`만 사용
- 커밋하지 않음
