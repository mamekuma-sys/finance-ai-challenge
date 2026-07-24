# P 스테이지 — 기획·명세 (목표 점수 85)

시작: 2026-07-24. R단계 이월 백로그(`docs/judging/scores/003-R.md`)를 처리하며 기획서·기능
명세서 초안을 만든다. 데이콘 별도 양식은 없음이 확인됨 → 심사 기준에서 역산한 자체 구조 사용.

## 문서

| 파일 | 내용 | 백로그 매핑 |
|---|---|---|
| `00-document-structure.md` | 기획서·기능명세서 구조 역산 (심사 기준 기반) | #4 양식 매핑 |
| `01-golden-time-sources.md` | 골든타임 공식 출처 3종 + 확정 인용 문장 | #3 (+0.5) ✅ |
| `02-impact-model.md` | 기대효과 산식 3종 (산식·가정·목표·측정) | #1 (+1.0) ✅ 초안 |
| `03-stack-proposal.md` | 기술 스택 (확정 — decisions.md 기록) | 스택 확정 ✅ |
| `04-competitor-usage.md` | 경쟁 서비스 검증 리포트 (웹 확인 기반) | #2 (+0.8) |
| `05-method-db-sources.md` | 수법 DB 출처 목록 (금감원·경찰청·KISA) | #5 (+0.3) |
| `10-proposal-draft.md` | 기획서 초안 (현재 `0.5-r4`) | — |
| `11-spec-draft.md` | 기능명세서 초안 (현재 `0.5-r4`) | — |
| `12-human-review.md` | 휴먼 심사위원 패널 리뷰 1라운드 | 검증 루프 |
| `13-revision-plan.md` | 개정 계약 r1 (D1~D17) | 검증 루프 |
| `14-human-review-r2.md` | 휴먼 패널 리뷰 2라운드 — 개정본 재검증 | 검증 루프 |
| `15-revision-plan-r2.md` | 개정 계약 r2 (E1~E8, M0 계약 동결 4조건) | 검증 루프 |
| `16-human-review-r3.md` | 휴먼 패널 리뷰 3라운드 — M단계 조건부 동의(진입 조건 4) | 검증 루프 |
| `17-revision-plan-r3.md` | 개정 계약 r3 (F1~F6, 코어 재동결·MCP 합성 전용) | 검증 루프 |
| `18-m0-freeze-verification.md` | 패널 4라운드 — M0 동결 검증(조건 3·4 충족, 1·2 잔여 V4-01~07) | 검증 루프 |
| `19-revision-plan-r4.md` | 개정 계약 r4 (G1~G7, M0 동결 마감 패치) | 검증 루프 |
| `20-m0-freeze-final.md` | 패널 5라운드 — **M0 계약 동결 선언**(V4 7건 전부 닫힘, M단계 착수 승인) | 검증 루프 |
| `21-revision-plan-r5.md` | 개정 계약 r5 (H1~H6, 법령 기한 정정·미검증 수치 금지) | M단계 검증 |
| `22-revision-plan-r6.md` | 개정 계약 r6 (I1~I4, 출처 entailment·행동 계층·정직 표기·템플릿 게이트) | M단계 검증 |

## 지금 유효한 계약은 무엇인가 (진입점)

**유효한 구현 계약은 `11-spec-draft.md`(현재 `0.5-r6`) 하나다.**
`13`·`15`·`17`·`19`·`21`·`22`는 그 문서에 이미 **반영 완료된 개정 이력**이며,
`12`·`14`·`16`·`18`·`20`은 각 개정을 촉발한 **검증 라운드 기록**이다.
과거 라운드 문서는 역사 기록이므로 수정하지 않는다 — 새 개정이 필요하면 **새 개정 계약
문서를 먼저 쓰고** 명세에 반영한다.

```text
검증 라운드(리뷰)            →  개정 계약(결정)              →  반영 대상
12-human-review              →  13-revision-plan   (D1~D17)  →┐
14-human-review-r2           →  15-revision-plan-r2 (E1~E8)  →│
16-human-review-r3           →  17-revision-plan-r3 (F1~F6)  →│  11-spec-draft.md
18-m0-freeze-verification    →  19-revision-plan-r4 (G1~G7)  →│  (0.5-r6, 단일 진실)
20-m0-freeze-final ── M0 동결 선언 ─────────────────────────  →│  + 10-proposal-draft.md
app/docs/evidence-verified   →  21-revision-plan-r5 (H1~H6)  →│
review-human / review-agent  →  22-revision-plan-r6 (I1~I4)  →┘
```

r5·r6은 M단계 구현 검증에서 나왔다 — r5는 **1차 출처 실접속 검증**
(`app/docs/evidence-verified.md`)이 법정 기한 오류와 미검증 수치를 찾아낸 결과이고,
r6은 **2방향 리뷰**(`app/docs/review-human.md` / `review-agent.md`)가 출처 entailment
부분지지와 템플릿 게이트 fail-open을 찾아낸 결과다.

## 검증 루프 (two-way)

초안 완성 시마다 ① AI 관점 — judge 스킬(P 스테이지, 루브릭 채점) ② 사람 관점 — 휴먼
심사위원 페르소나 리뷰(30초 훅·사내 공유 가능성·본선 경쟁력·과장/한계). 두 관점 모두
통과할 때까지 개선 루프를 반복한다.

## 원칙

- 기능명세서에 적은 기능은 배포 URL에서 전부 실제 작동해야 한다.
- MVP 범위는 "심사위원이 30초 안에 핵심 가치를 체험"할 수 있게 설계한다.
- 수치는 `docs/research/04-verification-digest.md`·`01-golden-time-sources.md` 통과분만 인용.

## 사용자 액션 (선택 — 있으면 가점)

- 경쟁 서비스 실기기 캡처 (시티즌코난·카뱅 스미싱 확인·1394): 휴대폰 캡처를 주면
  `04-competitor-usage.md`에 "실사용 확인" 등급으로 반영
