# Evidence contract 흐름

시각 다이어그램: [`rwa-guard-system-diagram.html`](./rwa-guard-system-diagram.html)

```text
발행 문서
  └─ ControlSpec(document page/span, confirmed)
          │
Solidity ─┴─ CodeFinding(rule, source hash, file/line, deterministic evidence)
          │
          └─ MismatchFinding(implemented/partial/missing/unknown)
                       │
Kairos 또는 Replay ─ OnchainEvidence(LIVE|REPLAY, tx/log/block)
                       │
                       └─ EvidenceReport(scan versions, lineage, immutable snapshot)
```

## 확정 규칙

- `CONFIRMED`: 결정적 룰 또는 테스트 증거가 있다.
- `PROBABLE`: 정적분석과 의미분석이 일치하지만 결정적 실행경로 확인이 부족하다.
- `NEEDS_REVIEW`: AI 또는 텍스트 사전검사만 주장한다.
- `UNKNOWN`: 컴파일, 소스, 프록시 등 입력 제약으로 분석할 수 없다.

텍스트 substring pre-screen은 후보 생성에만 사용하며 `CONFIRMED`를 만들 수 없다. P0 확정 finding은 AST/Slither/custom rule과 버전이 필요하다.
