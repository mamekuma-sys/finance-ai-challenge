# Definition of Done

## 모든 기능

- 합성 fixture만 사용하며 `is_synthetic=true`가 확인된다.
- 정상, 빈 상태, 로딩, 부분 실패, 분석 불가 상태가 구분된다.
- 입력 hash, rule/tool/model version, 생성 시각을 추적할 수 있다.
- 테스트와 수용 기준이 같은 용어를 사용한다.
- 미실측 성능 수치를 완료 실적으로 표시하지 않는다.

## P0 분석 기능

- 같은 입력과 rule version에서 같은 핵심 finding을 반환한다.
- AI 단독 finding은 `NEEDS_REVIEW`다.
- Critical/High는 문서 page/span과 코드 file/line을 모두 가진다.
- 취약본→수정본에서 `RESOLVED | REMAINS | NEW`가 표시된다.
- RPC와 AI 장애 시에도 합성 샘플 경로와 저장된 report를 열 수 있다.

## P1 LIVE 기능

- tx receipt와 block/log 식별자가 저장된다.
- `(chain_id, tx_hash, log_index)`로 이벤트가 중복 제거된다.
- 마지막 처리 block부터 재수집할 수 있다.
- LIVE 장애를 정상으로 표시하지 않는다.
- Replay 전환 시 mode와 fixture version을 표시한다.

## 제출

- 비로그인 브라우저에서 URL 접근 가능
- 9월 7일 11:00부터 9월 11일 23:59까지 모니터링
- 모든 외부 코드·데이터의 라이선스와 출처 기록
- 저장소와 브라우저 번들에 secret 없음
