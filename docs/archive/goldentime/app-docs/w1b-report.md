# W1-B 구현 보고서

- 기준일: 2026-07-25
- 계약: `docs/planning/11-spec-draft.md` 0.5-r4
- 범위: Rule 0 사기대응 데스크 UI(F-05·F-06·F-07·F-10·F-21)와 F-19
  `/llms.txt`

## 1. 구현 결과

| 화면·영역 | 기능 ID | 구현 내용 |
|---|---|---|
| 최상단 신뢰 띠·긴급 질문 | F-05, F-21 | 합성 샘플·무로그인·서버 무저장 고정 표시, 4개 긴급 선택, 선택 즉시 `decideActions` 호출 |
| 6개 상태 질문 | F-05, F-06 | 6개 네이티브 `fieldset`/`legend`/radio 그룹, `unknown`을 “모르겠어요”로 표시, 민감값 입력 없음 |
| 행동 카드 | F-06, F-21 | 최대 4개 순번, 1순위 골든 레일·“지금 먼저”, 목적 슬롯 전량, 전제·후속·공식 출처·필수 카드·접이식 추적 정보 |
| 실제 행동 수단 | F-06, F-07 | `tel:112`, `tel:1332`, `tel:1394`, FINE 금융회사 연락처 조회, 비전화 행동 체크 |
| 고정 문구 | F-07 | 규제 문구 레지스트리 본문과 엔진 목적 슬롯만 조립, Clipboard API와 textarea 선택 폴백 |
| 금지 행동·접힌 행동 | F-06 | 모든 카드의 금지 행동 합집합을 별도 고정 블록에 표시, `next_steps` 전량과 연속 priority 보존 |
| 상태 전환 비교 | F-05, F-06 | 송금 전/직후와 악성 앱 설치 토글, 좌우(모바일 상하) 비교, 추가·제거·순위 변경·전제·금지 행동 diff |
| 행동 이벤트 | F-06 | `viewed` 자동 기록, 전화 앱 선택, 사용자 연결·요청·접수 진술, 허용 전이 거부 사유, append-only correction, 출처 배지 |
| 경과 타이머 | F-06 | 첫 `user_statement`부터 경과 시간, 지연인출제도 고정 한계 문구 |
| 세션 저장·초기화 | F-06, F-10 | 상태·결과·이벤트·템플릿 버전·고령자 모드·세션 측정 표본을 `sessionStorage`에만 저장·복구 |
| 고령자 모드 | F-10 | 본문 20px, 핵심 행동 56px, 한 번에 현재 카드 1개, 다음 행동은 2차 버튼, 템플릿 ID는 상세 안에만 표시 |
| 근거·성능 패널 | F-05, F-21 | 확정된 5개 정량 근거와 링크, 브라우저 세션 Rule 0·비교 실측, 테스트 산출물의 전수 조합 수 |
| `/llms.txt` | F-19 | 요청 origin으로 절대 데스크 URL 생성, 동결된 8개 절 순서, 후속 기능은 미제공으로 명시 |

## 2. NF-01~NF-13 대응

| ID | 이번 W1-B 상태 | 근거 |
|---|---|---|
| NF-01 | 이번 주차 범위 밖 | 로컬 production start까지만 검증. 제출 배포·운영 모니터링은 후속 |
| NF-02 | 충족 | 로그인·계정·토큰 없이 `/` 사용 |
| NF-03 | 코드·테스트 충족, 실제 브라우저 최종 확인 대기 | 360px 미디어 규칙, 컨테이너·긴 문자열·비교 적층 구현. 실제 브라우저 런타임이 환경 권한으로 기동되지 않음 |
| NF-04 | 충족 | CSS 하한 테스트와 UI 클래스 테스트: 본문 20px, 기본 행동 56px, 한 화면 한 카드 |
| NF-05 | 자동 점검 충족, 실제 브라우저 수동 점검 대기 | axe WCAG A/AA 위반 0, 대비 토큰 9종 통과, 시맨틱 랜드마크·폼·포커스·live region |
| NF-06 | 계측 구현·산식 검증, production 브라우저 p95 대기 | 선택 입력 시 `performance.now()` 시작, double rAF 종료, nearest-rank p95 단위 테스트 |
| NF-07 | 충족 | 모델·API 호출 없이 정적 페이지와 결정 엔진만 사용 |
| NF-08 | 이번 주차 범위 밖 | 토큰·쿼터·CORS는 미구현 REST의 후속 계약이며 `/llms.txt`에도 미제공 표시 |
| NF-09 | UI측 충족 | fetch/XHR/sendBeacon 무호출 테스트, 세션 payload 민감 키 제거 테스트 |
| NF-10 | UI측 충족 | HTTPS 도메인/정확 URL allowlist와 유사 도메인·HTTP 차단 테스트 |
| NF-11 | 해당 없음 | 요청·분석·사용자 메트릭 전송 자체가 없음 |
| NF-12 | 충족 | 합성·무저장, 자동 관측·사용자 진술, 사용자 확인 시간의 한계를 텍스트 배지로 구분 |
| NF-13 | 기존 W1-A 게이트 유지 | W1-A 레지스트리 메타데이터 테스트를 변경하지 않았고 verify에서 함께 통과 |

## 3. `/llms.txt` 8절 대응

| 순서 | 내용 | 현재 배포본 표기 |
|---:|---|---|
| 1 | 목적·언어·권한 | 한국어 판단 보조, 실제 처리 권한 없음 |
| 2 | 데스크·상황실·안전성 위치 | 데스크는 요청 origin 절대 URL, `/room`·`/safety`는 후속 단계 |
| 3 | REST·MCP | 둘 다 현재 미제공 |
| 4 | 판정·근거 충분도 | 4등급 계약과 비확률 의미, 현재 판정 기능 미제공 |
| 5 | 합성·가림·무저장·금지 입력 | 구조화 상태만 제공, 자유 입력 후속, sessionStorage, 4종 금지 입력 |
| 6 | 토큰·쿼터·CORS·오류 | 현재 미제공, 후속 오류 비반사 계약만 표시 |
| 7 | 공식 재확인·긴급 행동 | 금융회사 공식 대표번호와 112 우선 |
| 8 | 평가·출처·갱신일 | 평가 미제공, 공개 기관 출처, 2026-07-25 |

## 4. 테스트와 production 서버

`npm run verify` 최종 결과:

```text
exit 0
TypeScript: 통과
ESLint: 통과(경고 0)
Vitest: 12 files, 50 tests passed
Next.js production build: 통과
/: static prerender
/llms.txt: route handler
```

전수 조합 수는 `decision-artifact.test.ts`가 상태 열거값의 데카르트 곱을 실제 실행하고
성공 횟수를 `public/generated/decision-verification.json`에 출력한다. 현재 산출물은
`verified_combinations=1152`, `status=passed`이며 UI는 이 JSON을 빌드할 때 읽는다.
W1-A 타입·엔진·템플릿·이벤트 로직·기존 테스트는 수정하지 않았다.

최신 빌드 production 서버:

```text
npm run start -- -p 3218
✓ Ready in 55ms

2026-07-25 03:40 KST
GET http://127.0.0.1:3218/          -> HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 13258
x-nextjs-prerender: 1

GET http://127.0.0.1:3218/llms.txt -> HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
X-Content-Type-Options: nosniff
```

SSR HTML에서 확인한 요청 대상은 같은 origin의 Next 정적 JS·CSS·폰트·favicon뿐이다.
외부 출처 URL은 앵커로만 존재하며 페이지 로드 중 요청하지 않는다.

## 5. 성능 실측

화면에는 측정 전 숫자를 만들지 않고 “아직 측정 전”으로 표시한다. 사용자가 긴급 응답을
고르면 입력 핸들러 시작 시각부터 안전 카드가 반영된 뒤 double
`requestAnimationFrame`까지를 표본으로 추가한다. 비교 토글도 같은 종료 기준을 사용한다.
세션 표본은 최대 200개이며 p95는 nearest-rank다.

| 계측 | 최신 값 | 표본 | p95 | 상태 |
|---|---:|---:|---:|---|
| Rule 0 첫 카드 페인트 | 미측정 | 0 | 미측정 | production 브라우저 자동화 환경 기동 실패 |
| 비교 재구성 | 미측정 | 0 | 미측정 | production 브라우저 자동화 환경 기동 실패 |

production 브라우저 실측을 시도했으나 이 실행 환경에서 다음 세 경로가 모두 막혔다.

1. Python Playwright Chromium: macOS Mach port rendezvous `Permission denied (1100)`
2. 인앱 브라우저: 사용 가능한 browser binding 없음
3. Orca computer-use: `runtime_open_timeout`

따라서 배포 환경 p95나 production 브라우저 콘솔 0건을 추정해서 기록하지 않았다.
Vitest/jsdom 상호작용 테스트 출력에는 React 오류·경고가 없었지만 실제 브라우저 콘솔
검증의 대체값으로 주장하지 않는다.

## 6. 접근성 점검

- axe-core WCAG 2 A/AA·2.1 A/AA·2.2 AA 규칙: 위반 0건
- WCAG 상대휘도 자동 테스트: 라이트·다크 본문, 보조문, 골드 버튼, 금지 블록, 포커스
  9개 조합 모두 기준 통과
- `html lang=ko`, 문서 제목, skip link, `main`/`section`/`aside`/heading/ordered list
- 모든 상태 입력은 `fieldset`·`legend`·네이티브 radio
- 모든 기본 행동 48px 이상, 고령자 모드 56px
- 복사·카드 재구성은 polite live region, 전이 거부는 alert
- `prefers-reduced-motion`과 `forced-colors` 보완 규칙
- 아이콘은 텍스트와 함께 쓰고 장식 아이콘은 접근성 트리에서 제외

실제 브라우저의 360/768/1280/1440 라이트·다크 스크린샷, 200% 확대, 키보드 탭 순서,
console 검사만 위 환경 제약 때문에 남았다.

## 7. 의도적으로 미구현한 항목

- F-03 판정·F-04 자유 질문/LLM 호출: W1-B 범위 밖
- F-08 브리핑 PDF·개인 부속면: 다른 주차
- F-16 REST·F-18 MCP: showcase 후속 단계
- `/room`, `/safety`, F-20 예비 평가 결과: 다른 티어·후속 단계
- “곧 제공” 버튼·샘플 응답·가짜 엔드포인트는 만들지 않았다.

## 8. 남은 TODO

1. 브라우저 실행 권한이 있는 환경에서 production URL을 360/768/1280/1440,
   라이트·다크·고령자 모드로 열어 가로 오버플로·시각 위계·콘솔을 최종 확인
2. 같은 환경에서 Rule 0과 비교 표본을 수집해 최근 값·N·nearest-rank p95를 이 보고서에
   기록
3. 비전화 행동의 완료를 사실대로 표현할 `ActionFactState` 계약 검토
   (`w1b-findings.md`)

리포 루트 `docs/`는 수정하지 않았고 커밋도 수행하지 않았다.
