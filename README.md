# 2026 금융 AI Challenge

> 상상을 넘어 실제로, AI로 움직이는 금융의 미래 — AI 기반 금융 현안 해결 아이디어 및 웹서비스(MVP) 개발 공모전 참가 프로젝트

## 핵심 일정

| 날짜 | 내용 |
|---|---|
| **2026. 9. 7.(월) 10:00** | 기획서(PDF) + MVP 산출물(기능명세서 PDF, 웹서비스 URL) 제출 마감 |
| 9. 7.(월) 11:00 ~ 9. 11.(금) 23:59 | 웹서비스 URL 접근 가능 필수 (다운 시 **결격**) |
| 10. 8.(목) 23:59 | (본선 진출 시) 발표자료 PDF + 소스코드 ZIP 제출 |
| 10. 13.(화) | (본선 진출 시) 오프라인 발표 심사 — PT 15분 + Q&A 5분 |

## 참가 정보

- **참가 형태**: 개인 참가 (1인 + AI 에이전트)
- **주제**: **골든타임(GoldenTime) — AI 사기대응 상황실.** 송금·앱 설치·인증정보 노출
  직후의 금융소비자에게 AI 판정보다 먼저 공식 첫 행동을 제시하고, 상태별 행동 카드·고정
  문구·신고 준비 브리핑을 제공하는 무로그인 웹 서비스 (`docs/research/06-decision.md`)
- **기술 스택**: Next.js(App Router)+TypeScript / Vercel / Claude API / SSE /
  Neon Postgres / MCP TypeScript SDK / Tailwind+shadcn

## 현재 상태 (2026-07-25)

- **P단계(기획·명세) 완료 — M0 계약 동결 선언.** 기획서·기능명세서 `0.5-r4`
  (`docs/planning/10`·`11`)가 구현 계약으로 확정됨.
- 검증: AI 심사 시뮬레이션 92.8/100(목표 85) + 휴먼 패널 페르소나 리뷰 5라운드 통과
  (`docs/judging/scores/history.md`, `docs/planning/12~20`).
- **다음: M단계(MVP 구현) W1** — Rule 0 긴급 카드 + 조치 결정 엔진 1,152개 상태 조합
  전수 테스트. 착수 컨텍스트는 `handoff.md` 참조.

## 프로젝트 구조

```
finance-ai-challenge/
├── README.md              # 이 파일
├── CLAUDE.md              # Claude Code(오케스트레이터) 컨텍스트
├── AGENTS.md              # Codex 등 하위 에이전트 공용 컨텍스트
├── handoff.md             # M단계 W1 착수용 세션 인수인계
├── docs/
│   ├── competition/       # 공모전 요강·제출물 체크리스트
│   ├── research/          # 주제 발굴 딥리서치·검증 산출물
│   ├── planning/          # 기획서·기능명세서·개정 계약·패널 리뷰 (00~20)
│   ├── judging/           # AI 심사 루브릭·채점 리포트 (judge 스킬)
│   └── decisions.md       # 주요 의사결정 로그
└── app/                   # MVP 웹서비스 (M단계 W1에서 스캐폴딩)
```

## 에이전트 운용 체계

- **Claude Code** — 오케스트레이터. 리서치, 기획, 작업 분배, 코드 리뷰, 통합을 담당.
- **Codex CLI** — 하위 코딩 에이전트. Claude가 `codex exec`로 구현 작업을 위임.

자세한 운용 규칙은 `CLAUDE.md` 참조.
