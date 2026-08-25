# RWA Guard Web

팀원 A의 기본 소유 경로다. Next.js App Router로 Assurance Ledger와 Evidence Spine을 구현한다.

```bash
npm install
npm run dev
npm run verify
```

- P0는 저장된 합성 fixture와 Replay만으로 렌더링되어야 한다.
- 실제 receipt가 없는 이벤트를 LIVE로 표시하지 않는다.
- API 계약은 backend OpenAPI에서 생성한 타입으로 교체한다.
