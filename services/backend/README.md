# RWA Guard Backend

팀원 B의 기본 소유 경로이며 팀원 C의 contract pipeline, 팀원 D의 chain worker가 같은 Python package를 공유한다.

```bash
python -m venv .venv
python -m pip install -e ".[dev]"
fastapi dev src/rwa_guard/api/main.py
python -m rwa_guard.worker
```

추가 도구는 필요한 트랙에서만 설치한다.

```bash
python -m pip install -e ".[analysis,chain,valuation,dev]"
```

P0 API는 P1 패키지나 RPC 연결이 없어도 기동해야 한다.
