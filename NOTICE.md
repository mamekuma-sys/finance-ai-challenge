# Third-party and data notice

현재 RWA Guard scaffold의 Solidity, Python, TypeScript 코드와 합성 fixture는 이 프로젝트를 위해 작성되었다.

- 프레임워크와 라이브러리의 저작권·라이선스는 각 배포 패키지의 메타데이터를 따른다.
- `data/synthetic/`에는 외부 실데이터가 포함되어 있지 않다.
- 외부 데이터, 아이콘, 코드, 모델 또는 폰트 파일을 저장소에 추가할 때는 출처·라이선스·취득일·변환과정을 이 파일 또는 해당 경로 README에 기록한다.
- 네트워크로 불러오는 폰트나 이미지에 제출 URL의 핵심 화면을 의존하지 않는다.
- 컨트랙트 AST 생성에는 Foundry `v1.7.1` 컨테이너 이미지와 solc `0.8.24`를 사용한다.
  Foundry는 MIT/Apache-2.0 이중 라이선스이며 출처는
  <https://github.com/foundry-rs/foundry>이다. 배포 이미지는 v1.7.1 manifest digest
  `sha256:8347b728d5d393dac1c018691b36f506d23b9dcd78341d40ea0fcb11c3a19cdd`로 고정한다.
