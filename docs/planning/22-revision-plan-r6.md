# 개정 계약 r6 — 출처 entailment 보강, 서면 제출 카드 행동 정정, 미구현 기능 암시 제거

- 문서 버전: `r6`
- 작성일: 2026-07-25 (M단계 W1 검증 라운드)
- 개정 대상: 기능명세서 `docs/planning/11-spec-draft.md`(0.5-r5 → **0.5-r6**)
- 근거 문서:
  - `app/docs/evidence-verified.md` §3 행동 카드 출처 entailment 판정표
  - `app/docs/review-human.md` (사람 3페르소나 리뷰, 43.2/100 · 재작업 필요)
  - `app/docs/review-agent.md` (Agent 소비자 리뷰, 60% · 중계 위험)
- 결정 번호: **I1~I4**

> **개정 사유:** W1 구현물을 대상으로 실행한 2방향 검증(사람 이해관계자 / 소비 에이전트)에서
> ① 행동 카드의 공식 출처가 카드의 핵심 동사를 지지하지 않는 경우가 R1·R2·R4·R5·R7에
> 존재하고(§6.3의 citation entailment 요구 미충족), ② `procedure:written_followup` 카드의
> 1차 행동이 계약상 “피해구제신청서 제출”인데 구현이 “1394 통화”로 승격했으며,
> ③ 미구현 기능(F-01 합성 샘플)을 화면 배지로 암시하고 있음이 확인됐다.
> **범위 티어(§2.1)·스키마(§4.1)·실행 알고리즘(§4.5.1)·severity(§4.5.2)·merge_key 어휘·
> 평가 계약(§5.4)은 변경하지 않는다.**

---

## I1. 【필수】 §4.5.3 규칙 표 공식 출처 보강 (행동 문구는 변경하지 않음)

`app/docs/evidence-verified.md` §3 판정표가 각 규칙의 핵심 동사를 지지하는 대체 공식 출처를
제시했다. **행동 문구·merge_key·순서는 그대로 두고 출처만 추가한다.**

### 신규 출처 (전부 2026-07-25 실접속 HTTP 200 확인)

| 출처 ID | 기관 · 문서 | URL |
|---|---|---|
| `SRC-FSC-CARDNEWS` | 금융위원회 · 전기통신금융사기 대응 카드뉴스 (**다른 휴대전화·PC 사용 권장**) | https://fsc.go.kr/no040000?cnId=1954 |
| `SRC-KISA-PHISHING` | 한국인터넷진흥원 · 피싱 주의 권고 (**공인인증서·보안카드 등 금융정보 폐기·재발급**) | https://spam.kisa.or.kr/spam/na/ntt/selectNttInfo.do?bbsId=1001&mi=1019&nttSn=2701 |
| `SRC-FSC-1332` | 금융위원회 · 1332 안내 | https://www.fsc.go.kr/no040102?cnId=913&curPage=1 |
| `SRC-LAW-DECREE3` | 국가법령정보센터 · 특별법 시행령 제3조 (**신청한 날부터 3일 이내 신청서 제출**) | https://www.law.go.kr/법령/전기통신금융사기피해방지및피해금환급에관한특별법시행령/제3조 |
| `SRC-KOREA-1394` | 경찰청·대한민국 정책브리핑 · 전기통신금융사기 통합대응단 1394 안내 | https://www.korea.kr/multi/visualNewsView.do?newsId=148959173 |

**주의:** `SRC-FSC-CARDNEWS` 원문에 남아 있는 구 표기 `3영업일`은 **재사용하지 않는다**
(r5 H1에 따라 현행 법령 원문이 우선). 이 출처는 **“다른 휴대전화·PC 사용 권장”** 근거로만 쓴다.

### 규칙별 출처 매핑 (개정 후)

| 규칙 | 개정 전 | **개정 후** |
|---|---|---|
| R1 | `SRC-FSC-MALAPP` | `SRC-FSC-MALAPP`, **`SRC-FSC-CARDNEWS`** |
| R2 | `SRC-FSC-MALAPP` | `SRC-FSC-MALAPP`, **`SRC-FSC-CARDNEWS`**, **`SRC-KISA-PHISHING`** |
| R3 | `SRC-EASYLAW-CONTACT`, `SRC-EASYLAW-STOPPAY` | + **`SRC-LAW-DECREE3`**, **`SRC-KOREA-1394`** |
| R4 | `SRC-FSC-10RULES` | `SRC-FSC-10RULES`, **`SRC-KISA-PHISHING`**, **`SRC-FSC-MALAPP`** |
| R5 | `SRC-FSS-1332` | `SRC-FSS-1332`, **`SRC-FSC-1332`**, **`SRC-FSC-10RULES`** |
| R6 | `SRC-FSC-10RULES` | 변경 없음 (판정 ✅지지) |
| R7 | `SRC-FSS-1332` | `SRC-FSS-1332`, **`SRC-FSC-1332`**, **`SRC-FSC-10RULES`** |

**행 단위로 정확히 매핑한다** — 그 행의 동사를 지지하는 출처만 그 행에 붙인다.
예: R2③ `인증수단 폐기·재발급`에는 `SRC-KISA-PHISHING`, R2①② 통화 행동에는
`SRC-FSC-MALAPP`·`SRC-FSC-CARDNEWS`.

### entailment 검수 픽스처 (신설 인수 기준)

§6.3의 “사람 표본 citation entailment 검수”를 구현 가능한 형태로 고정한다.
**`규칙·행 → 핵심 동사 → source_id → 원문 지지 문장`** 표를 테스트 픽스처로 두고,
모든 노출 카드의 `official_sources`가 그 카드 동사의 지지 출처를 **최소 1개 포함**하는지
자동 검증한다. 지지 출처가 없는 동사는 카드·템플릿에서 **노출하지 않는다**.

---

## I2. 【필수】 `procedure:written_followup` 카드의 1차 행동 정정

§4.5.3 R3③의 계약 순서는 **“피해구제신청서를 해당 금융회사에 제출하고, 이어서 1394에서
… 절차 확인”**이다. 구현은 1394 통화를 1차 CTA로 승격해, 사용자가 전화만 하면 서면 제출도
끝난 것으로 오해하게 만든다(사람 리뷰 B2).

**개정 내용 — UI·이벤트 계층 계약:**

- 이 카드의 **1차 행동은 “피해구제신청서 제출 방법 확인”**이며 `SRC-EASYLAW-STOPPAY`
  또는 `SRC-LAW-DECREE3`의 공식 안내를 연다.
- **1394는 2차 행동**(“1394에 절차 상담하기”)으로 내린다.
- 이 카드를 **전화 행동 카드로 분류하지 않는다** — 1394 다이얼러 열기를 이 카드의
  현재 상태 환원에 사용하지 않는다.
- 사용자 확인 라벨을 카드 성격에 맞게 분기한다:
  `user_reported_requested` → **“피해구제신청서를 금융회사에 제출했다고 확인했어요”**.
  **`ActionFactState` 열거값은 바꾸지 않는다**(§4.1·§4.6 동결) — **화면 라벨만** 분기한다.
- **안전 기기 전제 교차 규칙(신설):** `device_compromise_state ∈ {suspected_app,
  remote_control, unknown}`일 때, **UI가 `tel:` 행동을 렌더하는 모든 카드**는
  `prerequisite`에 안전 기기 전제를 포함해야 한다. 이 카드에 1394 2차 버튼이 남는 한
  이 규칙의 적용 대상이다.

---

## I3. 【필수】 미구현 기능 암시 제거 (§2.2 서두 “미구현 기능 암시 금지” 이행)

현재 화면 상단에 **“합성 샘플”** 배지가 고정돼 있고 `/llms.txt`도 “합성 샘플 표시”라고
쓰지만, **F-01의 합성 샘플 3건과 `scenario_id` 선택은 구현돼 있지 않다.**

- F-01이 구현되기 전까지 배지 문구를 **“구조화 상태 선택 데모”**로 바꾼다.
- `/llms.txt`의 해당 문장도 같은 기준으로 정정하고, 미제공 항목은 계속 **“현재 배포본
  미제공”**으로 명시한다.
- F-01·F-03·F-08 core E2E와 F-19 `/developers`를 구현한 뒤에만 배지·기능 목록을 승격한다.
- **이 조항은 W1 시점의 정직한 표시 규칙이며, core 티어를 축소하는 것이 아니다.**
  §2.1의 런타임 코어 9는 그대로이고 후속 주차에서 구현한다.

---

## I4. 【필수】 §4.7 템플릿 활성 게이트 fail-open 차단

§4.7은 `source_effective_date`에 **확인된 실제 값이 없으면 템플릿 비활성**,
`next_review_at` 경과 시 **운영 노출 차단**을 요구한다. 현재 무결성 검사는 문자열이
비었는지만 보므로 `source_effective_date_confirmed=false`인 템플릿 5종이 활성 상태로
화면에 **“승인된 고정 문구”**로 표시된다(두 리뷰 공통 지적).

**개정 내용 — 게이트 구현 계약:**

- 템플릿 상태를 `active` / `unconfirmed` / `expired`로 명시한다.
  - `source_effective_date_confirmed !== true` → `unconfirmed`
  - `next_review_at < 기준일` → `expired`
- **단일 resolver**를 두고 엔진·UI·빌드가 모두 이것만 사용한다. `active`가 아니면
  **본문 resolve를 실패시킨다.**
- **`active`가 아닌 템플릿에 “승인된 고정 문구” 배지를 붙이지 않는다.**
- **긴급 행동 자체는 유지한다** — 검증되지 않은 **문구 블록만** 숨기고 그 이유를 화면에
  표시한다(가짜 승인 표시가 문구 부재보다 위험하다).
- 검수일(`source_reviewed_at`)을 시행일(`source_effective_date`) 대용으로 쓰지 않는다.
- 각 안내의 실제 시행일을 공식 원문에서 확인해 채우고 `confirmed=true`로 전환하는 것을
  **W2 착수 전 백로그**로 둔다.

---

## 적용 순서

1. 본 문서 확정(= 이 커밋)
2. `app/src/lib/decision/sources.ts`·`rules.ts` 출처 보강(I1) + entailment 픽스처
3. `procedure:written_followup` UI·이벤트 계층 정정(I2)
4. 배지·`llms.txt` 정직 표기(I3)
5. 템플릿 resolver·게이트(I4)
6. `docs/planning/11-spec-draft.md` 0.5-r6 개정(§4.5.3 출처 열, §4.7 게이트 서술, §9 인수 기준)
7. judge 재채점 + 2방향 재검증

## 범위 밖(변경하지 않음)

- §2.1 범위 티어·런타임 코어 9, §4.1 스키마, §4.5.1 실행 알고리즘, §4.5.2 severity_rank,
  merge_key 어휘, §4.6 `ActionFactState` 열거값, §5.4 평가 계약·임계값
- R1~R7의 **행동 문구와 순서** (출처만 보강)
- 과거 라운드 기록 문서(`12`~`20`)
