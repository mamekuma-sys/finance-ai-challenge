# RWA Guard 팀 간 계약

`schemas/`는 네 트랙이 병렬 개발할 때 사용하는 bootstrap JSON Schema다. 런타임 원본은 `services/backend/src/rwa_guard/domain/contracts.py`의 Pydantic 모델이며, OpenAPI와 TypeScript 타입은 이 모델에서 생성한다.

## 계약

| Schema | 생산자 | 소비자 |
|---|---|---|
| `control-spec` | 문서 pipeline | contract 비교, Web, report |
| `code-finding` | contract pipeline | mismatch, Web, report |
| `onchain-evidence` | chain worker 또는 Replay loader | alert, Web, report |
| `mismatch-finding` | policy comparison | Web, report |
| `scan-run` | job worker | Web, diff, report |
| `evidence-report` | report assembler | Web, HTML/JSON export |

## 변경 규칙

1. Pydantic 모델을 먼저 변경한다.
2. schema와 OpenAPI를 다시 생성한다.
3. `examples/evidence-report.sample.json`을 갱신한다.
4. Web 소비 타입과 contract test를 같은 변경에서 통과시킨다.
5. enum을 조용히 추가하거나 의미를 바꾸지 않는다.

모든 온체인 증거는 `mode=LIVE|REPLAY`를 포함한다. 모든 예시는 합성 데이터다.
