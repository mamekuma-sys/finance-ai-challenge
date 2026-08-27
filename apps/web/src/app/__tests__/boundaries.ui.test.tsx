import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AssetError from "../assets/[id]/error";
import AssetLoading from "../assets/[id]/loading";
import RootError from "../error";
import RootLoading from "../loading";
import ReportError from "../reports/[id]/error";
import ReportLoading from "../reports/[id]/loading";

const LOADERS = [
  { name: "root", Loading: RootLoading },
  { name: "assets/[id]", Loading: AssetLoading },
  { name: "reports/[id]", Loading: ReportLoading },
];

const ERRORS = [
  { name: "root", ErrorBoundary: RootError },
  { name: "assets/[id]", ErrorBoundary: AssetError },
  { name: "reports/[id]", ErrorBoundary: ReportError },
];

describe("loading 경계", () => {
  for (const { name, Loading } of LOADERS) {
    it(`${name} announces what is being waited on rather than only spinning`, () => {
      render(<Loading />);
      expect(screen.getByRole("status")).toHaveTextContent(/불러오는 중/);
    });
  }
});

describe("error 경계", () => {
  for (const { name, ErrorBoundary } of ERRORS) {
    it(`${name} shows the failure and offers a retry`, () => {
      render(<ErrorBoundary error={new Error("boom")} reset={() => {}} />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    });
  }

  it("reads as natural Korean without a doubled object particle", () => {
    render(<RootError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("관제 홈을 불러오지 못했습니다.");
  });

  it("runs the framework reset when retry is pressed", async () => {
    const reset = vi.fn();
    render(<RootError error={new Error("boom")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("never leaks the raw error message to the screen", () => {
    render(<RootError error={new Error("psycopg: password authentication failed")} reset={() => {}} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("psycopg");
  });
});
