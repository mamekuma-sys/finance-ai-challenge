/**
 * 코드 뷰가 보여주는 컨트랙트 발췌.
 *
 * chain/src/fixtures/의 실제 fixture에서 가져온 것이다. 각 발췌의 첫 줄이
 * `firstLine`에 해당하므로, CodeFinding의 start_line과 줄 번호가 맞는다.
 * 파일 원문을 받는 endpoint가 생기면 이 상수는 사라진다.
 */
export interface SourceExcerpt {
  firstLine: number;
  source: string;
}

const EXCERPTS: Record<string, SourceExcerpt> = {
  "chain/src/fixtures/VulnerableRwaToken.sol": {
    firstLine: 9,
    source: `contract VulnerableRwaToken {
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }
}`,
  },
  "chain/src/fixtures/VulnerableOracle.sol": {
    firstLine: 15,
    source: `contract VulnerableOracle {
    int256 public latestAnswer;

    function update(int256 answer, uint256 at) external {
        latestAnswer = answer;
        updatedAt = at;
    }
}`,
  },
};

export function excerptFor(file: string): SourceExcerpt | undefined {
  return EXCERPTS[file];
}
