# RWA Guard 인수인계 — 재스캐폴딩 기준

기준일: 2026-08-25

## 현재 상태

- 4인 팀 기준 PRD와 기술 방향 반영 완료
- 이전 프로젝트 코드·문서는 활성 저장소에서 전부 삭제
- 새 Web/API/chain/contracts/data/infra 구조 생성
- 다음 구현 순서는 `docs/project/milestones.md`를 따른다.

## 첫 통합 목표

합성 발행 문서와 취약 Solidity fixture를 입력해 다음 경로가 작동해야 한다.

```text
ControlSpec
  → CodeFinding
  → MismatchFinding
  → EvidenceReport
  → apps/web Evidence Spine
```

P0는 Replay만으로도 작동해야 하며, P1 Kairos 기능은 receipt와 중복 제거가 검증된 뒤에만 LIVE로 노출한다.

## 즉시 할 일

1. `contracts/schemas/` 예시를 Pydantic 모델과 OpenAPI로 연결
2. Web에서 `data/synthetic` 데모 자산을 읽는 정적 관제 화면 완성
3. 문서 추출과 3종 contract rule의 fixture 테스트 작성
4. Supabase migration과 local backend health를 검증
5. 8월 30일 첫 E2E 전에 팀 간 필드명 동결
