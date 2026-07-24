# CLAUDE.md — 오케스트레이터 컨텍스트

## 프로젝트 개요

2026 금융 AI Challenge(주최: 금융보안원, 후원: 금융위원회) 참가 프로젝트.
금융 현안을 정의하고 AI 기반 해결 웹서비스를 MVP로 구현해 제출한다.

- **참가 형태**: 개인 참가 (사용자 1인 + AI 에이전트)
- **1차 마감**: 2026. 9. 7.(월) 10:00 — 기획서 PDF + 기능명세서 PDF + 배포 URL
- **URL 유지**: 9. 7. 11:00 ~ 9. 11. 23:59 접근 불가 시 결격
- 전체 요강: `docs/competition/overview.md` / 제출 체크리스트: `docs/competition/checklist.md`

## 현재 상태 (2026-07-25)

- 주제: **확정** — "골든타임(GoldenTime) — AI 사기대응 상황실" (`docs/research/06-decision.md`)
- 기술 스택: **확정** — Next.js+TS / Vercel / Claude API / SSE / Neon Postgres / MCP SDK
  (`docs/planning/03-stack-proposal.md`)
- 스테이지: **M0 계약 동결 완료(2026-07-25) → M단계 착수 승인.** 기획서·기능명세서
  `0.5-r4`(`docs/planning/10`·`11`), 개정 계약 r1~r4(`13`·`15`·`17`·`19`), 휴먼 패널
  5라운드 통과(`12`·`14`·`16`·`18`·`20`). 범위 계약: 런타임 코어 9 + 정적(F-19) +
  release gate(F-20) + showcase + nice, 주차별 게이트 W1~W6 — **코어 추가·축소 금지,
  동결된 계약(§4.5 결정 엔진·§5.4 평가·§2.1 티어·§4.1~4.3 토큰/MCP)은 구현 중 임의
  변경 금지(새 개정 계약 문서로만)**
- 주요 결정은 `docs/decisions.md`에 기록할 것

### 문서 작업 원칙 (P단계에서 확립)

- **수치 인용**: `docs/research/04-verification-digest.md` 정정표와
  `01-golden-time-sources.md` 통과분만. 금지 표현: 피해 "폭증"(정부 프레임은 감소+풍선효과),
  "최초·유일", 기능 부재 단정(`X`는 "공식 자료에서 확인되지 않음").
- **개정 루프**: 휴먼 패널 리뷰 → 개정 계약 문서(결정 번호 D/E/F…) 확정 → 초안 반영(버전
  올림) → judge 재채점 → 패널 재검증. 개정은 반드시 계약 문서를 먼저 쓰고 따른다.
- **용어 계약**: "행동 이벤트 이력(내 기기 보관)"(원장 아님), "6단계 처리·검증
  파이프라인"(에이전트 수 표현 금지), `evidence_strength`=근거 충분도(확률 아님),
  "예비 평가"(일반화 주장 금지), MCP v1은 합성 `scenario_id` 전용.

## 에이전트 운용 규칙

Claude Code가 오케스트레이터, Codex CLI가 하위 코딩 에이전트다.

- Claude 담당: 리서치, 기획, 아키텍처 결정, 작업 분해·위임, 코드 리뷰, 통합, 문서화
- Codex 담당: 명확히 스코프가 정의된 구현 작업 (컴포넌트 구현, 테스트 작성, 리팩터링 등)

### Codex 위임 방법

Bash로 비대화형 실행. **모델은 반드시 `gpt-5.6-sol` + `xhigh`를 명시한다** (사용자 지정 정책, 2026-07-24):

```bash
codex exec --skip-git-repo-check -m gpt-5.6-sol -c model_reasoning_effort=xhigh \
  -s workspace-write -C <작업디렉토리> "<작업 지시>"
```

- 웹 리서치가 필요한 작업엔 `-c tools.web_search=true -c sandbox_workspace_write.network_access=true` 추가.
- 긴 지시는 프롬프트 파일로 작성 후 `- < prompt.md` 로 stdin 전달.

- 작업 지시는 **자기완결적**으로 작성: 목표, 대상 파일, 제약, 완료 기준을 명시. Codex는 `AGENTS.md`를 자동으로 읽으므로 프로젝트 공통 컨텍스트는 거기에 유지한다.
- Codex 결과물은 반드시 Claude가 리뷰 후 통합한다 (diff 확인, 테스트 실행).
- 병렬 작업 시 파일 충돌이 없도록 작업 단위를 분리해 위임한다.

## 채점 루프 (judge 스킬)

- 스테이지 산출물을 커밋할 때마다 `judge` 스킬(`.claude/skills/judge/`)로 자가 채점한다.
  루브릭: `docs/judging/rubric.md` / 리포트: `docs/judging/scores/`
- 스테이지 목표: R 80 / P 85 / M 85 / F 90. 목표 미달이면 개선 백로그를 처리한 뒤 재채점.
- git commit 실행 시 PostToolUse 훅(`.claude/settings.json`)이 채점 리마인드를 띄운다.

## Git 규칙

- 원격: `https://github.com/mamekuma-sys/finance-ai-challenge` (origin, 브랜치 `main`).
- **커밋 후 즉시 `git push origin main`** — 커밋만 하고 푸시를 미루지 않는다
  (다른 세션·기기에서 이어받는 워크플로우이므로 로컬 전용 커밋을 남기지 말 것).

## 작업 규칙

- 공모전 제출물(기획서, 기능명세서)은 데이콘 제공 양식 기반으로 작성 후 PDF 변환.
- 실제 금융데이터 사용 불가 — 공개 데이터(금융감독원 오픈API, 공공데이터포털 등) 또는 합성 데이터만 사용.
- 심사위원이 직접 URL에 접속해 사용한다 — 로그인 장벽 최소화, 데모 계정·샘플 데이터 필수.
- 타인 저작물·코드·데이터 무단 사용 금지 (표절 시 실격).
