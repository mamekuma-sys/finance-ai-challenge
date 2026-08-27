import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockReceipt } from "../block-receipt";
import type { OnchainEvidence } from "@/types/contracts";

const REPLAY = {
  asset_id: "asset_synthetic_hanriver_01",
  mode: "REPLAY",
  chain_id: 1001,
  tx_hash: "0xsynthetic000000000000000000000000000000000000000000000000000001",
  log_index: 0,
  block_number: 18402119,
  event_name: "Minted",
  previous_value: "100000",
  changed_value: "120000",
  fixture_version: "0.1.0",
  is_synthetic: true,
} as OnchainEvidence;

const LIVE = { ...REPLAY, mode: "LIVE", fixture_version: null } as OnchainEvidence;

describe("BlockReceipt", () => {
  it("shows the event, block and value change", () => {
    render(<BlockReceipt evidence={REPLAY} />);

    expect(screen.getByText("Minted")).toBeInTheDocument();
    expect(screen.getByText(/18,402,119/)).toBeInTheDocument();
    expect(screen.getByText(/100,000/)).toBeInTheDocument();
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
  });

  it("truncates the transaction hash but keeps it available in full", () => {
    render(<BlockReceipt evidence={REPLAY} />);

    const hash = screen.getByTestId("tx-hash");
    expect(hash).toHaveTextContent("…");
    expect(hash).toHaveAttribute("title", REPLAY.tx_hash);
  });

  it("shows the fixture version in replay mode", () => {
    render(<BlockReceipt evidence={REPLAY} />);
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });

  it("does not offer an explorer link for replayed evidence", () => {
    render(<BlockReceipt evidence={REPLAY} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers an explorer link only when the evidence is live", () => {
    render(<BlockReceipt evidence={LIVE} />);

    const link = screen.getByRole("link", { name: /탐색기/ });
    expect(link).toHaveAttribute("href", expect.stringContaining(LIVE.tx_hash));
  });
});
