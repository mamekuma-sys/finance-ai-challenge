import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScreenStateNotice } from "../screen-state-notice";

describe("ScreenStateNotice", () => {
  it("renders nothing in the normal state so the screen is not decorated", () => {
    const { container } = render(<ScreenStateNotice state="normal" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names what is being waited on while loading", () => {
    render(<ScreenStateNotice state="loading" />);
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
  });

  it("keeps partial failure honest by saying the successful part still stands", () => {
    render(<ScreenStateNotice state="partial" />);
    expect(screen.getByRole("status")).toHaveTextContent("일부 검사가 실패");
  });

  it("uses 확인 필요 rather than inventing a value when analysis is impossible", () => {
    render(<ScreenStateNotice state="unknown" />);
    expect(screen.getByRole("status")).toHaveTextContent("확인 필요");
  });

  it("labels replay evidence as 재현 and shows the fixture version", () => {
    render(<ScreenStateNotice state="replay" fixtureVersion="replay-fixture/0.1.0" />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("재현");
    expect(notice).toHaveTextContent("replay-fixture/0.1.0");
  });

  it("never claims 실시간 in the replay state", () => {
    render(<ScreenStateNotice state="replay" fixtureVersion="replay-fixture/0.1.0" />);
    expect(screen.getByRole("status")).not.toHaveTextContent("실시간");
  });
});
