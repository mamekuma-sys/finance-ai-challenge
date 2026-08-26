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

결정론적 컨트랙트 검사는 Foundry `v1.7.1`과 solc `0.8.24` AST를 사용한다. 로컬에서는
`forge`를 PATH에 두거나 `RWA_GUARD_FORGE_BIN`으로 실행 파일을 지정한다. 배포 Docker
이미지는 같은 버전의 도구와 컴파일러를 포함하며 분석 중 외부 네트워크를 사용하지 않는다.
