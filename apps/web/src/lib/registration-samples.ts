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
export const SAMPLE_CONTRACT_PATH = "/samples/VulnerableRwaToken.sol";

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
