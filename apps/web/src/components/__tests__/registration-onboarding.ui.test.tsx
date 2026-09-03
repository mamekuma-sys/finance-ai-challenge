import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationDialog } from "@/components/registration-dialog";
import type { RegistrationDependencies } from "@/lib/registration-workflow";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/adapters/assets", () => ({ createAsset: vi.fn(), createContract: vi.fn() }));
vi.mock("@/lib/adapters/documents", () => ({ uploadDocument: vi.fn() }));

/** public/samples는 실제 정본 사본이다. 테스트도 그 파일을 그대로 읽어 배선까지 확인한다. */
function servePublicSample(path: string) {
  const file = readFileSync(resolve(process.cwd(), `public${path}`), "utf8");
  return Promise.resolve({ ok: true, text: () => Promise.resolve(file) } as Response);
}

function deps(): RegistrationDependencies & { calls: { source?: string; address?: string } } {
  const calls: { source?: string; address?: string } = {};
  return {
    calls,
    createAsset: vi.fn().mockResolvedValue({ asset_id: "asset_1" }),
    uploadDocument: vi.fn().mockResolvedValue({ document_id: "doc_1" }),
    createContract: vi.fn().mockImplementation((_assetId, input) => {
      calls.source = input.source_code;
      calls.address = input.address;
      return Promise.resolve({ contract_id: "contract_1" });
    }),
  };
}

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(result.violations).toEqual([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn((input: string) => servePublicSample(String(input))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("등록 마법사 온보딩", () => {
  it("샘플 값으로 1단계 필수 입력을 채워 검증을 통과한다", async () => {
    const user = userEvent.setup();
    const view = render(<RegistrationDialog dependencies={deps()} />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));

    await user.click(view.getByRole("button", { name: "샘플 값으로 채우기" }));
    expect(view.getByLabelText("자산명")).toHaveValue("한강 오피스 수익증권 01");
    expect(view.getByLabelText("예정 공급량")).toHaveValue(100000);

    await user.click(view.getByRole("button", { name: "다음: 문서" }));
    expect(view.getByRole("group", { name: "2. 발행 문서" })).toBeVisible();
  });

  it("문서 단계에서 필요한 통제조건 6개를 예시 문장과 함께 보여준다", async () => {
    const user = userEvent.setup();
    const view = render(<RegistrationDialog dependencies={deps()} />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));
    await user.click(view.getByRole("button", { name: "샘플 값으로 채우기" }));
    await user.click(view.getByRole("button", { name: "다음: 문서" }));

    const checklist = view.getByRole("list", { name: "문서에 필요한 통제조건" });
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(6);
    expect(checklist).toHaveTextContent("최대 발행량");
    expect(checklist).toHaveTextContent("총 발행량은 100,000 토큰을 초과할 수 없다.");
    expect(checklist).toHaveTextContent("비상 통제");
  });

  it("샘플 발행조건서와 샘플 컨트랙트만으로 등록을 끝낸다", async () => {
    const user = userEvent.setup();
    const dependencies = deps();
    const view = render(<RegistrationDialog dependencies={dependencies} />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));
    await user.click(view.getByRole("button", { name: "샘플 값으로 채우기" }));
    await user.click(view.getByRole("button", { name: "다음: 문서" }));

    await user.click(view.getByRole("button", { name: "샘플 발행조건서 사용" }));
    await waitFor(() => expect(view.getByRole("status")).toHaveTextContent("issuance-terms-01.txt"));
    await user.click(view.getByRole("button", { name: "다음: 코드" }));

    expect(view.getByRole("radio", { name: /샘플 취약 컨트랙트 사용/ })).toBeChecked();
    expect(view.queryByLabelText("Kaia 컨트랙트 주소")).not.toBeInTheDocument();
    await waitFor(() => expect(view.getByRole("button", { name: "자산 등록" })).toBeEnabled());
    await user.click(view.getByRole("button", { name: "자산 등록" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/assets/asset_1/document"));
    expect(dependencies.calls.source).toContain("contract VulnerableRwaToken");
    expect(dependencies.calls.address).toBeUndefined();
  });

  it("입력 방법을 고른 것만 렌더하고 잘못된 주소를 인라인으로 막는다", async () => {
    const user = userEvent.setup();
    const dependencies = deps();
    const view = render(<RegistrationDialog dependencies={dependencies} />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));
    await user.click(view.getByRole("button", { name: "샘플 값으로 채우기" }));
    await user.click(view.getByRole("button", { name: "다음: 문서" }));
    await user.click(view.getByRole("button", { name: "샘플 발행조건서 사용" }));
    await waitFor(() => expect(view.getByRole("status")).toBeInTheDocument());
    await user.click(view.getByRole("button", { name: "다음: 코드" }));

    await user.click(view.getByRole("radio", { name: /배포된 Kaia 주소 입력/ }));
    expect(view.queryByLabelText("Solidity source")).not.toBeInTheDocument();
    await user.type(view.getByLabelText("Kaia 컨트랙트 주소"), "0x123");
    await user.click(view.getByRole("button", { name: "자산 등록" }));

    expect(view.getByRole("alert")).toHaveTextContent("40자리 16진수");
    expect(dependencies.createAsset).not.toHaveBeenCalled();
  });

  it("열린 마법사 DOM에 axe 위반이 없다", async () => {
    const user = userEvent.setup();
    const view = render(<RegistrationDialog dependencies={deps()} />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));
    await expectNoAxeViolations(view.container.ownerDocument.body);
  });
});
