# RWA Guard Solidity fixtures

팀원 C의 기본 소유 경로다. P0 검사 3종을 취약·수정 fixture로 재현한다.

```bash
forge fmt --check
forge build
forge test -vv
```

- `VulnerableRwaToken`: 접근권한, 발행 한도, 담보 gate가 없다.
- `FixedRwaToken`: issuer, maxSupply, collateralVerified를 검사한다.
- `VulnerableOracle`: 0·음수·오래된 가격을 허용한다.
- `FixedOracle`: 유효범위와 갱신시각을 검사한다.

모두 합성 데모용이며 실제 금융상품에 배포하지 않는다.
