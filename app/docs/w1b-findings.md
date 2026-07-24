# W1-B 구현 중 확인한 계약 경계

## 비전화 행동 완료 상태

`ActionFactState`의 진행 상태는 `viewed → dialer_opened →
user_reported_connected → user_reported_requested →
user_reported_receipt_confirmed`로 전화 절차를 표현한다. 반면 W1-B 화면에는
`device:isolate`, `action:stop_contact`처럼 전화가 아닌 행동도 있으며, 동결 타입에는
이 행동의 “완료”를 사실대로 기록할 별도 상태가 없다.

재현 조합:

- `transfer_state=already_sent`
- `device_compromise_state=suspected_app`
- `credential_exposure_state=none`
- `personal_data_exposure_state=none`
- `user_role=self`
- `safe_device_available=no`

이 조합의 1순위 `device:isolate` 카드에서 “이 기기 사용을 멈췄어요”를
`user_reported_connected`로 기록하면 상태 의미(통화 연결 사실)와 어긋나고,
`viewed`에서 바로 기록하면 동결 전이 함수도 `INVALID_TRANSITION`으로 거부한다.

W1-A 로직과 타입은 수정하지 않았다. W1-B에서는 비전화 행동 체크를 별도 화면 확인 상태로
`sessionStorage`에 보관하고, `ActionFactEvent[]`에는 카드 노출(`viewed`)만 자동 기록한다.
기관 연결·요청·접수 컨트롤은 실제 기관 연락이 있었을 때만 사용하라는 문구를 함께 표시한다.
후속 계약 개정 시 비전화 행동용 사용자 확인 상태를 추가할지 검토해야 한다.
