# HANDOFF — M단계 W1 착수 (작성: 2026-07-25, P단계 종료 시점)

새 세션 인수인계 문서. `CLAUDE.md`(오케스트레이터 규칙)와 `AGENTS.md`(Codex 공용
컨텍스트)를 먼저 읽은 뒤 이 문서로 현재 시점을 잡는다.

## 1. 현재 상태 (한눈에)

- **스테이지**: P(기획·명세) 완전 종료 → **M단계 W1 착수 승인** 상태. `app/` 미생성.
- **M0 계약 동결 선언됨** (2026-07-25, `docs/planning/20-m0-freeze-final.md`):
  기획서·기능명세서 **`0.5-r4`가 구현 계약**이다. 결정 엔진(§4.5)·평가 계약(§5.4)·범위
  티어(§2.1)·토큰/MCP(§4.1~4.3)는 **구현 중 임의 변경 금지** — 변경이 필요하면 새 개정
  계약 문서(`docs/planning/21-…`)를 먼저 쓰고 반영한다.
- **검증 성적**: judge 92.8/100(목표 85, `docs/judging/scores/008-P.md`), 휴먼 패널
  5라운드 통과(리뷰 `12`→`14`→`16`→`18`→`20`, 개정 계약 `13`→`15`→`17`→`19`).
- 마감: **W1 게이트 ~8/2** / 배포 동결 9/6 / 제출 9/7 10:00 / URL 유지 ~9/11.

## 2. W1 작업 목록 (기능명세서 `docs/planning/11-spec-draft.md` 기준)

1. **프로젝트 셋업**: `app/`에 Next.js(App Router)+TypeScript. 배포 대상 Vercel,
   DB는 Neon Postgres(W1에서는 스키마만·연결 불필요), Tailwind+shadcn.
2. **Rule 0 정적 카드 (F-05 일부)**: 첫 화면 긴급 질문 → 6개 상태 필드(§4.4) 입력 →
   모델 호출 없이 결정적 안전 카드 즉시 렌더. **p95 ≤ 2초(배포 환경), 측정 이벤트 =
   응답 선택 입력 확정 → 카드 첫 페인트**(NF-06). 상태 전환 비교 재구성 p95 ≤ 5초.
3. **조치 결정 엔진 (§4.5 총함수)**: 순수 조건식 R1~R7(§4.5.3) + 실행 알고리즘
   6단계(§4.5.1). 순수 함수 모듈로 구현(프레임워크 독립, 서버·클라이언트 공용).
4. **전수 테스트**: 1,152개(3×4×4×4×2×3) 조합 property 테스트 — §9.3의 검증 속성 4종
   ① 긴급 우선 불변식 ② `already_sent` 전 조합 서면 후속 카드 단일 포함 ③ `next_steps`
   무손실+전체 순위 연속 번호 ④ `purpose_slots`·`official_sources` 합집합 보존.
   §4.5.4 **인수 스냅샷 5종(a~e)** 정확 일치 테스트 포함.

## 3. 결정 엔진 구현 시 놓치기 쉬운 계약 (전부 §4.5에 명문)

- **질문 카드 위치**: unknown 축의 **잠재 severity**(device→1, transfer→3, credential→4,
  personal_data→6)가 확인된 최고 severity보다 높을(숫자 작을) 때만 1번, 아니면 긴급 카드
  직후. **확인된 severity 1~6이 없으면 rank 7 기준 → 질문 1번.** 복수 unknown은 잠재
  severity 오름차순 최대 3개, 4축 모두 unknown이면 personal_data 질문 제외.
- **전역 후속은 "승격"**: `transfer_state=already_sent`이면 R3가 수집한
  `procedure:written_followup` 카드를 승격(새 카드 생성 금지, 없을 때만 생성) —
  항상 노출 4개 안, 접힘 불가.
- **수정자 카드**: `family_proxy`+절차 카드 존재 → `notice:proxy_scope` 카드를 마지막
  노출 순위로 **생성**. `device ∈ {suspected_app, remote_control, unknown}` → 모든
  통화·앱 카드에 안전 기기 전제 + 금지 행동 전역 추가.
- **슬롯·직렬화**: 강제 노출(전역 후속, proxy)이 슬롯 예약 → 남은 슬롯은 정렬 상위 일반
  카드 → 초과분은 낮은 severity부터 `next_steps`(소실 금지). `priority`는 노출 1~4,
  `next_steps` 5부터 **전체 순위 연속 번호**.
- **스키마(§4.1 그대로)**: `ActionCard.official_sources: string[]`(단수 아님),
  `purpose_slots`, `do_not_show_when`(조건식)과 `prohibited_actions`(경고 문구) 분리,
  `AnalyzeResponse.next_steps`. 행동 이벤트는 `ActionFactEvent[]`
  (`event_type`/`corrects_event_id`, 배열 순서 기준 환원) — W2 범위지만 타입은 W1에 정의.
- **용어**: "행동 이벤트 이력(내 기기 보관)" — "원장" 표기 금지. 그 외 용어·금지 표현은
  `AGENTS.md` 문서·용어 규칙 절 참조.

## 4. 운용 방식

- **Codex 위임**: `codex exec --skip-git-repo-check -m gpt-5.6-sol -c
  model_reasoning_effort=xhigh -s workspace-write -C <디렉토리> "<지시>"` (긴 지시는
  프롬프트 파일 + `- < prompt.md`). Codex는 `AGENTS.md`를 자동으로 읽는다. 결과물은
  Claude가 diff 리뷰·테스트 실행 후 커밋.
- **채점 루프**: 스테이지 산출물 커밋마다 judge 스킬(M단계 목표 85). 휴먼 패널(Codex
  sol/xhigh 페르소나 리뷰)은 주요 게이트(W1 완료 등)에서 실행.
- **주차 게이트 미달 시**: showcase 슬롯을 코어 복구에 사용, 코어 축소 금지(§2.1).

## 5. 핵심 파일 맵

| 파일 | 역할 |
|---|---|
| `docs/planning/11-spec-draft.md` | **구현 계약(단일 진실)** — §4.5 결정 엔진, §4.1 스키마, §9 인수 기준 |
| `docs/planning/10-proposal-draft.md` | 기획서(심사 서사) |
| `docs/planning/20-m0-freeze-final.md` | M0 동결 선언·근거 |
| `docs/decisions.md` | 결정 로그(동결 조건 포함) |
| `docs/judging/rubric.md` + `scores/history.md` | 채점 루브릭·궤적(001~008) |
| `docs/planning/05-method-db-sources.md` | 수법 DB 소스·라이선스 판정(W2+ 사용) |
| `docs/competition/checklist.md` | 제출 체크리스트(수정 금지) |

## 6. W1 이후 대기 항목 (지금 하지 않음)

- W2~W6: 이벤트 이력·레지스트리 → 브리핑 이중 구성·고령자 모드 → LLM 3단계·폴백 →
  평가·release gate·showcase → 배포 동결·hwpx 전사.
- P단계 잔여 백로그: ① hwpx 양식 전사 리허설(+팀명 확정, W6 전 아무 때나),
  ② 경쟁 서비스 실기기 캡처(**사용자 액션** — 받으면 `04-competitor-usage.md` 승격),
  ③ 금감원 2021 설문 원문 보도자료 링크 교체.
