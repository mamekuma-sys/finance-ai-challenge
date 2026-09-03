import { P0_CONTROL_FIELDS, type P0ControlField } from "@/lib/document-review-state";

/**
 * 등록 마법사가 쓰는 합성 샘플 정의.
 *
 * 빈 폼을 채우라고 요구하는 대신 `data/synthetic/`과 `chain/src/fixtures/`의
 * 정본을 그대로 불러와 "수정 가능한 예시"로 보여준다. public 사본이 정본과
 * 어긋나면 `registration-samples.test.ts`가 실패한다.
 */
export const SAMPLE_DOCUMENT_PATH = "/samples/issuance-terms-01.txt";
export const SAMPLE_DOCUMENT_NAME = "issuance-terms-01.txt";

/**
 * 샘플 시나리오 2종.
 *
 * 결과를 가르는 것은 발행조건서가 아니라 컨트랙트다. 결정론적 룰은 코드
 * 실행경로에 가드가 있는지만 보고 문서 값과 비교하지 않으므로, 조건서를 둘로
 * 나눠도 같은 컨트랙트면 같은 결함이 나온다. 그래서 문서는 하나로 두고
 * 시나리오가 문서와 컨트랙트를 짝으로 채운다.
 *
 * 토큰과 오라클을 함께 넣어야 P0 룰 3종이 모두 판정 대상이 된다.
 */
export type SampleScenario = "vulnerable" | "clean";

export const SAMPLE_SCENARIOS: Record<
  SampleScenario,
  { label: string; expectation: string; detail: string; contractPaths: readonly string[] }
> = {
  vulnerable: {
    label: "샘플 A · 확정 위험 발생",
    expectation: "통제 공백 4건 · Exploit Risk 100 CRITICAL",
    detail:
      "발행조건서 + 가드가 빠진 컨트랙트. mint에 권한·담보·한도 검사가 없고 오라클 값 검증도 없습니다.",
    contractPaths: ["/samples/VulnerableRwaToken.sol", "/samples/VulnerableOracle.sol"],
  },
  clean: {
    label: "샘플 B · 깨끗한 결과",
    expectation: "결함 0건 · Exploit Risk 0 LOW",
    detail:
      "같은 발행조건서 + 가드를 넣은 컨트랙트. 결정론적 룰이 결함을 찾지 못합니다.",
    contractPaths: ["/samples/FixedRwaToken.sol", "/samples/FixedOracle.sol"],
  },
};

const SPDX_LINE = /^[ \t]*\/\/[ \t]*SPDX-License-Identifier:.*$/gm;

/**
 * 여러 .sol을 하나의 컴파일 단위로 합친다. 백엔드 `merge_solidity_sources`와
 * 같은 규칙이다. SPDX 헤더는 하나만 남기고, version pragma는 지우지 않는다.
 * pragma를 지우면 뒤 파일의 컴파일러 버전 제약이 조용히 사라진다.
 */
export function mergeSoliditySources(
  sources: readonly { path: string; text: string }[],
): string {
  const header = sources
    .map((source) =>
      source.text.match(/^[ \t]*\/\/[ \t]*SPDX-License-Identifier:.*$/m)?.[0].trim(),
    )
    .find((line): line is string => Boolean(line));
  const bodies = sources.map((source) => ({
    path: source.path,
    body: source.text.replace(SPDX_LINE, "").trim(),
  }));
  if (!bodies.some((item) => item.body)) return "";
  const parts = [
    ...(header ? [header] : []),
    "// RWA Guard derived compilation unit; not a canonical source file.",
    ...bodies
      .filter((item) => item.body)
      .map((item) => `// BEGIN SOURCE: ${item.path}\n${item.body}\n// END SOURCE: ${item.path}`),
  ];
  return `${parts.join("\n\n")}\n`;
}

export async function fetchScenarioContract(scenario: SampleScenario): Promise<string> {
  const paths = SAMPLE_SCENARIOS[scenario].contractPaths;
  const texts = await Promise.all(paths.map((path) => fetchSampleText(path)));
  return mergeSoliditySources(paths.map((path, index) => ({ path, text: texts[index] })));
}

export const SAMPLE_ASSET = {
  name: "한강 오피스 수익증권 01",
  underlying: "서울 여의도 소재 합성 상업용 오피스의 임대수익. 공모전 데모용 가상 자산이다.",
  supply: "100000",
  currency: "KRW",
  unit: "TOKEN",
} as const;

/** 샘플 발행조건서에서 실제로 뽑히는 문장. 사용자가 자기 문서를 판단하는 기준이 된다. */
export const DOCUMENT_CHECKLIST: readonly { field: P0ControlField; example: string }[] = [
  { field: "max_supply", example: "총 발행량은 100,000 토큰을 초과할 수 없다." },
  { field: "issuer_role", example: "ISSUER_ROLE을 가진 주소만 토큰을 발행할 수 있다." },
  { field: "collateral_verified", example: "collateralVerified=true로 확정된 이후에만 발행한다." },
  { field: "oracle_max_age", example: "가격은 60분 이내에 갱신되어야 한다." },
  { field: "price_band_breach", example: "기준가 밴드 이탈이 연속 2회 확인되면 경보를 생성한다." },
  { field: "pauser_role", example: "PAUSER_ROLE을 가진 주소만 발행과 이전을 일시정지한다." },
];

/** P0 6개 조건을 하나도 빠뜨리지 않는다. 체크리스트가 곧 문서 수용 기준이다. */
export const CHECKLIST_COVERS_P0 = P0_CONTROL_FIELDS.every((field) =>
  DOCUMENT_CHECKLIST.some((item) => item.field === field),
);

export async function fetchSampleText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`sample_unavailable:${path}`);
  return response.text();
}

export async function fetchSampleDocument(): Promise<File> {
  const text = await fetchSampleText(SAMPLE_DOCUMENT_PATH);
  return new File([text], SAMPLE_DOCUMENT_NAME, { type: "text/plain" });
}
