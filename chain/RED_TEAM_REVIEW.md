# C-track detector red-team review

Review date: 2026-08-27

This review covers the three P0 rules in `SECURITY_RULES.md`. All executable examples are synthetic
Solidity fixtures. The evaluation corpus and recorded counts are in
`services/backend/tests/golden/adversarial_cases.json` and `contract-evaluation.json`.

## Confirmed bypasses and false positives fixed

| Area | Candidate reviewed | Previous risk | Locked result |
| --- | --- | --- | --- |
| All guards | `safeCondition || bypassEnabled` | A name-only walk treated either disjunct as a guard | `CONFIRMED` |
| All guards | Reversed or permissive comparisons | Operator polarity was ignored | `CONFIRMED` |
| All guards | Guarded mutation inside the true branch | Branch facts were not propagated | no finding |
| Helper calls | Safe and deliberately mismatched arguments | Callee parameter names could hide the actual caller value | safe / `CONFIRMED` |
| Mint access | Role mapping indexed by recipient, not `msg.sender` | Any role and sender names could look authorized | `CONFIRMED` |
| Mint cap | A different supply variable is capped | Any supply/cap names could look sufficient | `CONFIRMED` |
| Oracle | Different parameters are validated and stored | Guard and storage inputs were not associated | `CONFIRMED` |
| Mint mutation | Supply decrease | A burn could be treated as mint | no finding |
| Transaction outcome | Modifier always reverts after `_` | A non-committing mutation could be reported | no finding |

The analyzer now uses comparison truth, `&&`/`||` path semantics, declaration references, direct-call
parameter bindings, simple local aliases, and the actual supply increment subject. A cap fact applies
only to the state variable and increment value it bounds. Oracle facts apply only to the answer and
timestamp values stored by the same entry point.

## Coverage record

- Access: direct issuer equality, role mapping, `require`, `if/revert`, reversed operands, inherited
  modifier/helper, multiple modifiers, two-level internal calls, local aliases, multiple external
  mint entry points, and a partially guarded alternative path.
- Collateral/cap: collateral-only, cap-only, combined checks, disjunctive bypass, wrong direction,
  unrelated supply, wrong helper arguments, reversed equivalent comparison, branch-only mutation,
  modifier and helper implementations.
- Oracle: non-positive answer, zero boundary, future timestamp, stale timestamp, strict safe
  boundaries, combined `if/revert`, `require`, modifier/helper, disjunctive bypass, partial guards,
  branch-only storage, and unrelated validated inputs.
- False-positive checks: burn/decrease, read-only and comment-only inputs, safe inheritance/helpers,
  safe branch mutation, local aliases, and an always-reverted transaction.

## Unsupported-state outcomes

| Input | Outcome |
| --- | --- |
| External validator or unknown external call before mutation | `NEEDS_REVIEW` |
| `delegatecall` / proxy path | `NEEDS_REVIEW` |
| Inline assembly/Yul mutation | `NEEDS_REVIEW` |
| Internal function pointer | `NEEDS_REVIEW` |
| Recursive call graph | `NEEDS_REVIEW` |
| Modifier postlude that affects commit semantics | `NEEDS_REVIEW` |
| Loop/try control flow in a protected entry point | `NEEDS_REVIEW` |
| Unclassified storage mutation in a mint/oracle-like entry point | `NEEDS_REVIEW` |
| Compiler failure or incomplete source/inheritance set | `UNKNOWN` |

Unsupported inputs are not counted as binary positives or negatives in Precision/Recall.

## Final executable evaluation

| Rule | TP | FP | TN | FN | Needs review | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `MINT_ACCESS_CONTROL_MISSING` | 9 | 0 | 13 | 0 | 7 | 1.00 | 1.00 |
| `MINT_COLLATERAL_CAP_MISSING` | 9 | 0 | 13 | 0 | 7 | 1.00 | 1.00 |
| `ORACLE_VALIDATION_MISSING` | 7 | 0 | 7 | 0 | 3 | 1.00 | 1.00 |

These values describe only the checked-in synthetic corpus; they are not a production accuracy
claim.

## Remaining P0 limits

- The engine is a bounded AST/path analyzer, not a general symbolic executor.
- It supports direct storage mutations and straightforward Solidity comparisons/arithmetic. Struct,
  array, generated-code, and complex alias/data-flow cases are not promoted to safe results.
- Conditional modifier postludes are reviewed rather than interpreted as pre-mutation guards.
- Arbitrary proxy storage resolution, external library semantics, assembly/Yul, runtime dispatch,
  recursive graphs, and loop invariants remain outside P0.
- Semantic categories still use supported domain identifiers after declaration resolution. Unknown
  storage categories in protected entry points are surfaced for review instead of being declared
  safe.

No shared Pydantic/OpenAPI/TypeScript contract changed in this review. The earlier replacement of
`MINT_CAP_MISSING` with `MINT_COLLATERAL_CAP_MISSING` still requires B-track review before merge.
