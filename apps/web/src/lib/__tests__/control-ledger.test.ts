import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { IMPLEMENTATION_LABEL } from "@/components/control-card";
import {
  CONTROL_LEDGER_LABEL,
  RULE_MAPPED_CONTROL_FIELDS,
  controlLedgerState,
} from "@/lib/control-ledger";
import { P0_CONTROL_FIELDS } from "@/lib/document-review-state";

describe("control ledger state", () => {
  it("mirrors the backend FIELD_RULE_MAP exactly", async () => {
    const source = await readFile(
      new URL(
        "../../../../../services/backend/src/rwa_guard/pipelines/mismatch.py",
        import.meta.url,
      ),
      "utf8",
    );
    const block = source.split("FIELD_RULE_MAP")[1].split("}")[0];
    const backendFields = [...block.matchAll(/"([a-z_]+)":\s*"[A-Z_]+"/g)]
      .map((match) => match[1])
      .sort();

    expect(backendFields).toEqual([...RULE_MAPPED_CONTROL_FIELDS]);
  });

  it("leaves the two unmapped P0 controls out of code scope", () => {
    const unmapped = P0_CONTROL_FIELDS.filter(
      (field) => !RULE_MAPPED_CONTROL_FIELDS.some((mapped) => mapped === field),
    );

    expect(unmapped).toEqual(["price_band_breach", "pauser_role"]);
    for (const field of unmapped) {
      expect(controlLedgerState({ field, scanStatus: "COMPLETED" })).toBe("OUT_OF_SCOPE");
    }
  });

  it("never calls a finding-free result implemented", () => {
    const state = controlLedgerState({ field: "max_supply", scanStatus: "COMPLETED" });

    expect(state).toBe("NO_FINDING");
    expect(CONTROL_LEDGER_LABEL[state]).toBe("결함 없음");
    expect(CONTROL_LEDGER_LABEL[state]).not.toBe("구현됨");
  });

  it("does not turn a failed scan into a clean control", () => {
    expect(controlLedgerState({ field: "max_supply", scanStatus: "FAILED" })).toBe("UNKNOWN");
    expect(controlLedgerState({ field: "max_supply", scanStatus: "RUNNING" })).toBe("SCANNING");
    expect(controlLedgerState({ field: "max_supply", scanStatus: null })).toBe("UNCHECKED");
  });

  it("keeps server judgements authoritative", () => {
    for (const implementation of ["MISSING", "UNKNOWN", "IMPLEMENTED", "PARTIAL"] as const) {
      expect(
        controlLedgerState({ field: "max_supply", implementation, scanStatus: "COMPLETED" }),
      ).toBe(implementation);
    }
  });

  it("calls the same verdict the same thing on every screen", () => {
    // 자산 원장과 검사 결과 화면이 서버 판정을 서로 다른 이름으로 부르면
    // 같은 결함이 두 개로 읽힌다.
    for (const status of ["MISSING", "IMPLEMENTED", "PARTIAL", "UNKNOWN"] as const) {
      expect(CONTROL_LEDGER_LABEL[status]).toBe(IMPLEMENTATION_LABEL[status]);
    }
    expect(CONTROL_LEDGER_LABEL.MISSING).toBe("통제 공백");
  });
});
