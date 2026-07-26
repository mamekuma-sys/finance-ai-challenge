# W1-A 계약 메모

## 계약 모순 의심 — 확인 질문의 단순 정렬 비등가

- 재현 상태: `transfer_state=unknown`, `device_compromise_state=suspected_app`,
  `credential_exposure_state=suspected`, `personal_data_exposure_state=none`,
  `safe_device_available=no`, `user_role=self`
- 단순 `(severity ASC, order ASC, rule_ids[0] ASC, merge_key ASC)` 결과:
  잠재 severity 3인 송금 확인 질문이 R4의 확인된 severity 5 행동보다 앞선다.
- §4.5.1 ②의 명시 결과: 질문의 잠재 severity 3이 확인된 최고 severity 2보다 높지
  않으므로, 질문은 확인된 severity 1~5 행동이 모두 나온 직후에 위치해야 한다.
- 구현 결정: `engine.ts`의 `applyQuestionPosition`과 `compareCards`에서 §4.5.1 ②의 명시
  위치 규칙을 우선했다. `assertQuestionPlacement`가 전 상태에서 이 우선순위를 검증한다.

이는 규칙·severity 값을 변경한 것이 아니라, 구현 지시가 정한 “비등가 시 §4.5.1 ② 우선”을
적용한 것이다.
