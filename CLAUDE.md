# CLAUDE.md — RWA Guard 오케스트레이션 컨텍스트

## 현재 기준

- 4인 팀 RWA Guard로 전환 완료
- PRD: `docs/product/prd.md` v1.1
- 기술 방향: `docs/architecture/stack-and-visual-direction.md`
- 제출 계약: P0 우선, P1은 2026-09-03 승격 게이트 통과 시 LIVE 노출
- 이전 프로젝트 코드와 문서는 활성 저장소에서 삭제 완료

## 통합 순서

1. 공통 schema와 합성 fixture 고정
2. 네 트랙 병렬 개발
3. 매일 계약 example 검증
4. 8월 30일 첫 수직 E2E
5. 9월 3일 P1 LIVE 승격 판정
6. 9월 5일 기능 동결
7. 9월 6일 10회 리허설

`AGENTS.md`의 범위 불변식과 `docs/project/definition-of-done.md`를 모든 작업에 적용한다. 커밋과 푸시는 사용자 또는 지정 오케스트레이터가 수행한다.
