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
| Inheritance dispatch | Virtual hook/modifier override removes base guards | The base implementation could hide the effective derived behavior | `CONFIRMED` |
| Inheritance dispatch | Derived virtual hook/modifier adds all guards | The unguarded base body could create a false positive | no finding |
| Path-local aliases | First branch binds guarded values, alternate branch binds bypass values | One branch's bindings could be reused for every state | `CONFIRMED` |
| Helper aliases | Caller, parameter, and helper-local aliases cross scope frames | A valid subject binding could be lost on helper return | no finding |
| Hidden syntax | Mutation inside `unchecked` or an internal call used by `return` | The statement walker could skip the mutation | `CONFIRMED` |
| Constant rollback | Mutation followed by `require(false)` | A never-committing path could be reported | no finding |
| Path-specific rollback | Only an unguarded alias path reverts after mutation | A reverted state could leak into a committing sibling state | no finding |
| Name collision | Guard-like local/event/comment names | Text or unrelated declarations could appear protective | `CONFIRMED` / no mutation finding |
| Guard calls | Boolean-return helper or external call controls safety | Unknown call semantics could be promoted or silently treated as safe | `NEEDS_REVIEW` |
| Ambiguous increase | `totalSupply *= factor` | Multiplication was treated as a definite non-increase | `NEEDS_REVIEW` |
| Finding identity | Overloaded mint entry points reach the same helper mutation | Name-only entry points could collide or sort by hash | distinct stable findings |

The analyzer now uses comparison truth, `&&`/`||` path semantics, declaration references,
branch-specific bindings, scoped direct-call parameters, virtual override dispatch, canonical entry
point signatures, and the actual supply increment subject. A cap fact applies only to the state
variable and increment value it bounds. Oracle facts apply only to the answer and timestamp values
stored by the same entry point. `unchecked`, return-expression calls, and constant-false rollbacks
are interpreted without source rewriting.

## Threat model

The attacker controls every submitted source byte and may choose misleading names, shadowed locals,
overloads, inheritance order, overrides, modifiers, aliases, branches, early exits, late checks,
rollback-only paths, or unsupported dynamic execution. `solc 0.8.24` AST/source maps are trusted;
source text, ABI names, and AI/third-party detector labels are not. A Critical/High `CONFIRMED`
requires a compiler-resolved protected mutation and a supported path that lacks an exact dominating
guard. Compiling-but-opaque semantics are reviewed, while missing or failed AST input is unknown.

## Coverage record

- Access: direct issuer equality, role mapping, `require`, `if/revert`, reversed operands, inherited
  modifier/helper, virtual hook/modifier overrides, multiple modifiers, two-level internal calls,
  branch-specific and cross-helper aliases, overloaded external mint entry points, and a partially
  guarded alternative path.
- Collateral/cap: collateral-only, cap-only, combined checks, disjunctive bypass, wrong direction,
  unrelated supply, wrong helper arguments, reversed equivalent comparison, branch-only mutation,
  late guards, virtual modifier/helper implementations, and ambiguous multiplicative updates.
- Oracle: non-positive answer, zero boundary, future timestamp, stale timestamp, strict safe
  boundaries, combined `if/revert`, `require`, modifier/helper, disjunctive bypass, partial guards,
  branch-only storage, branch-specific aliases, helper-local aliases, late validation, name
  collisions, and unrelated validated inputs.
- False-positive checks: burn/decrease, read-only and comment-only inputs, safe inheritance/helpers,
  safe virtual overrides, safe branch mutation, local aliases, constant-false rollback, and an
  always-reverted transaction.

## Unsupported-state outcomes

| Input | Outcome |
| --- | --- |
| External validator or unknown external call before mutation | `NEEDS_REVIEW` |
| Boolean-return internal helper used as a guard | `NEEDS_REVIEW` |
| `delegatecall` / proxy path | `NEEDS_REVIEW` |
| Inline assembly/Yul mutation | `NEEDS_REVIEW` |
| Internal function pointer | `NEEDS_REVIEW` |
| Recursive call graph | `NEEDS_REVIEW` |
| Modifier postlude that affects commit semantics | `NEEDS_REVIEW` |
| Loop/try control flow in a protected entry point | `NEEDS_REVIEW` |
| Unclassified storage mutation in a mint/oracle-like entry point | `NEEDS_REVIEW` |
| Ambiguous multiplicative supply mutation | `NEEDS_REVIEW` |
| Compiler failure or incomplete source/inheritance set | `UNKNOWN` |
| Missing, empty, or non-analyzable compiler AST | `UNKNOWN` |

Unsupported inputs are not counted as binary positives or negatives in Precision/Recall.

## Final executable evaluation

| Rule | TP | FP | TN | FN | Needs review | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `MINT_ACCESS_CONTROL_MISSING` | 17 | 0 | 20 | 0 | 10 | 1.00 | 1.00 |
| `MINT_COLLATERAL_CAP_MISSING` | 17 | 0 | 21 | 0 | 9 | 1.00 | 1.00 |
| `ORACLE_VALIDATION_MISSING` | 10 | 0 | 10 | 0 | 4 | 1.00 | 1.00 |

These values describe only the checked-in synthetic corpus; they are not a production accuracy
claim.

## Slither cross-validation

Slither `0.11.6` analyzed 84 compiled contracts with 102 built-in detectors and emitted 100 general
results. It found the intended `controlled-delegatecall`, two inline-assembly sites, and two local
shadowing sites. It did not provide a detector equivalent to any of the three RWA Guard rules; its
timestamp detector reported safe and vulnerable freshness comparisons alike. Slither is therefore
kept as optional corroboration for unsupported constructs, never as the source of a P0
`CONFIRMED` result.

## Remaining P0 limits

- The engine is a bounded AST/path analyzer, not a general symbolic executor.
- It supports direct storage mutations and straightforward Solidity comparisons/arithmetic. Struct,
  array, generated-code, and complex alias/data-flow cases are not promoted to safe results.
- Conditional modifier postludes are reviewed rather than interpreted as pre-mutation guards.
- Arbitrary proxy storage resolution, external library/boolean-return semantics, assembly/Yul,
  function-pointer dispatch, explicit `super` call semantics, recursive graphs, tuple/destructuring
  aliases, complex casts/arithmetic, and loop invariants remain outside P0.
- Semantic categories still use supported domain identifiers after declaration resolution. Unknown
  storage categories in protected entry points are surfaced for review instead of being declared
  safe.

The shared Pydantic/OpenAPI/TypeScript contract is integrated by the stacked B-track change before
this C-track branch is marked ready for review.
