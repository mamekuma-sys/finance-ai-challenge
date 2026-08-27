import "@testing-library/jest-dom/vitest";
import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Providers } from "../providers";

function Probe() {
  const { data } = useQuery({
    queryKey: ["probe"],
    queryFn: () => Promise.resolve("scan_01"),
  });

  return <p>{data ?? "대기"}</p>;
}

describe("Providers", () => {
  it("renders children", () => {
    render(
      <Providers>
        <p>본문</p>
      </Providers>,
    );

    expect(screen.getByText("본문")).toBeInTheDocument();
  });

  it("supplies a query client so screens can poll scan state", async () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    await waitFor(() => expect(screen.getByText("scan_01")).toBeInTheDocument());
  });
});
