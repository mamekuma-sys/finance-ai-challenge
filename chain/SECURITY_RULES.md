# RWA Guard P0 deterministic contract rules

This document is the C-track executable contract for the three P0 Solidity rules. Rule output
must follow `CodeFinding`; text or AI screening alone can never create a `CONFIRMED` finding.

The final adversarial review record and executable corpus metrics are documented in
[`RED_TEAM_REVIEW.md`](RED_TEAM_REVIEW.md).

## Threat model and trust boundary

The submitted Solidity source set is hostile input. An author may use inheritance, virtual
overrides, modifier indirection, helper calls, local aliases, misleading identifiers, overloaded
entry points, branch-specific values, late checks, or rollback-only paths to hide the effective
entry point-to-mutation behavior. The compiler-complete UTF-8 source bytes are the evidence root;
comments, event names, ABI names, and detector prose are never proof of a guard.

RWA Guard trusts the pinned `solc 0.8.24` AST and source map, then applies a bounded deterministic
path interpretation. Each branch carries its own guard facts and local bindings. Calls into
resolvable internal functions, inherited virtual hooks, and virtual modifiers use the most-derived
implementation selected by Solidity's linearization. A guard counts only when its successful fact
is tied to the exact caller/value/storage subjects and dominates the protected mutation. A guard
after mutation does not satisfy this structural rule. An unconditional revert, including
`require(false)`, removes a non-committing path instead of producing a finding.

The engine does not trust boolean-return guard helpers, external calls, runtime dispatch, arbitrary
type conversions, or ambiguous arithmetic enough to declare a path safe. A compiling path that
depends on those semantics is `NEEDS_REVIEW`; missing or unusable compiler AST, incomplete sources,
and compilation failure are `UNKNOWN`. This is a bounded P0 analyzer, not a claim of complete
Solidity verification or production accuracy.

## Shared analysis contract

- Supported input is a compiling Solidity `0.8.x` source set supplied directly to RWA Guard.
- Analysis must use compiler AST/source maps and a deterministic call/control-flow analysis.
- The analyzer starts at every `public` or `external` entry point that can reach a protected state
  mutation, including through internal helpers, modifiers, and inherited implementations.
- A guard protects a mutation only when the successful form of the guard dominates that mutation
  on every reachable path from the entry point.
- `CONFIRMED` requires successful compilation and AST creation, supported source, a resolved entry
  point-to-mutation path, a missing required dominating guard, and exact source evidence.
- Compiling source with unresolved proxy delegation, function-pointer/dynamic dispatch, inline
  assembly that affects the path, or an out-of-scope external guard is `NEEDS_REVIEW`.
- Compilation/AST failure or an input with no analyzable contract is `UNKNOWN`.
- A supported, fully analyzed source with all required guards produces no finding for that rule.
- Source hashes are SHA-256 over normalized relative path plus original UTF-8 source bytes in
  lexicographic path order. Analysis must never rewrite the source before locating evidence.
- `finding_id` is derived from rule ID, rule version, source hash, relative file, protected entry
  point signature, and mutation start offset. It does not depend on scan time or traversal order.
- `code_location` points to the first unguarded protected mutation in source order. The excerpt is
  the complete source line(s) covering that AST node, with original whitespace and no surrounding
  unrelated lines. Further paths and guard locations belong in `deterministic_evidence`.
- `tool_versions` contains at least `rwa_guard_contract`, the exact rule version, and `solc`.
- Findings are sorted by rule ID, relative file, start line, and entry point signature.
- Overloaded entry points retain their canonical parameter types in evidence and finding identity.
- Byte-equivalent core output excludes only the caller-supplied `scan_id`; JSON object keys are
  serialized canonically by the regression harness.

P0 supports direct contracts, ordinary inheritance resolvable within the submitted source set,
modifiers, internal/private helpers, `require`, `revert`-style `if` guards, role mappings,
issuer/owner address comparisons, branch-local aliases, `unchecked` blocks, internal calls used as
return expressions, virtual hook/modifier overrides, and straightforward Solidity
arithmetic/comparisons.

P0 does not claim support for arbitrary proxies, `delegatecall`, runtime function pointers,
guard logic hidden behind unknown external calls, Yul/inline-assembly mutations, generated source,
boolean-return guard helper semantics, tuple/destructuring data flow, arbitrary storage aliases,
complex arithmetic such as multiplicative supply updates, or contracts whose complete
inheritance/source set is unavailable.

## Slither cross-check boundary

Slither `0.11.6` was run against the full synthetic chain corpus with 102 built-in detectors. It
correctly surfaced the checked-in `delegatecall`, inline assembly, and local-shadowing signals, but
it has no built-in detector that proves the three RWA Guard P0 predicates. Its timestamp detector
also reports both valid freshness guards and invalid oracle paths, so the signal is not a
classification oracle. Slither remains optional cross-check evidence only: it cannot replace the
AST engine and cannot create a `CONFIRMED` P0 finding by itself.

## `MINT_ACCESS_CONTROL_MISSING`

| Field | Contract |
| --- | --- |
| Rule version | `1.0.0` |
| Severity | `CRITICAL` |
| Protected mutation | Increase of token supply or recipient balance reachable from a mint-like external entry point |
| Vulnerable | At least one reachable path to the mutation lacks a dominating authorization guard tied to `msg.sender` |
| Safe | Every reachable mint path is dominated by issuer/owner equality or role/allowlist membership validation |

Supported authorization patterns include a direct `msg.sender == issuer/owner` check, a modifier
containing that check, an internal helper that reverts on failure, a boolean role/allowlist mapping
indexed by `msg.sender`, and an inherited resolvable modifier or helper. A function name such as
`onlyIssuer`, a comment, event, unused guard, or guard occurring after the mutation is not evidence.

The finding evidence must name the external entry point, the unguarded mutation, the resolved call
path, and the absence of a dominating authorization condition. A vulnerable-to-fixed rescan is
`RESOLVED` when the same protected mutation is no longer reachable without such a guard.

## `MINT_COLLATERAL_CAP_MISSING`

| Field | Contract |
| --- | --- |
| Rule version | `1.0.0` |
| Severity | `CRITICAL` |
| Protected mutation | Increase of token supply reachable from a mint-like external entry point |
| Vulnerable | At least one reachable mint path lacks either a collateral-ready guard or a maximum-supply guard |
| Safe | Every reachable mint path is dominated by both guards before supply increases |

The collateral guard must require a verified/active collateral state. The cap guard must prove the
post-mint supply cannot exceed a configured maximum, such as `totalSupply + amount <= maxSupply` or
an equivalent checked expression. Checking only collateral or only the cap remains vulnerable.
Checks after supply mutation, unused reads, events, comments, and variable names are not guards.

The evidence must state separately whether `collateral_guard` and `cap_guard` are present or missing,
and identify each unguarded entry point-to-supply-mutation path. A vulnerable-to-fixed rescan is
`RESOLVED` only when both guards dominate every such mutation.

This combined rule is the only supported P0 identifier for collateral and maximum-supply guards.
The backend producer, schemas, report fixture, and Web consumer migrate together.

## `ORACLE_VALIDATION_MISSING`

| Field | Contract |
| --- | --- |
| Rule version | `1.0.0` |
| Severity | `HIGH` |
| Protected mutation | Storage of an oracle answer and its observation/update timestamp |
| Vulnerable | At least one reachable update path lacks answer validity, future-time, or maximum-age validation |
| Safe | Every update path rejects non-positive answers, future timestamps, and timestamps older than `maxAge` before storage |

The three required guards are `answer > 0`, `updatedAt <= block.timestamp`, and
`block.timestamp - updatedAt <= maxAge`, or compiler-AST-equivalent forms. All three must dominate
both answer and timestamp storage. Updater authorization alone is insufficient. P0 does not infer
validity from an unknown external aggregator or library call; that case is `NEEDS_REVIEW`.

The evidence must state separately whether `positive_answer`, `not_future`, and `max_age` guards are
present or missing, then identify the first unguarded oracle storage mutation. A vulnerable-to-fixed
rescan is `RESOLVED` only when all three guards dominate every oracle update path.

## Finding and rescan expectations

For vulnerable supported fixtures, the exact rule ID, severity, `CONFIRMED` status, deterministic
evidence, source hash, rule/tool versions, and non-empty file/line/excerpt are mandatory. Safe
fixtures must not emit that rule. Unsupported-but-compiling fixtures must not be silently treated as
safe. They emit the specified `NEEDS_REVIEW`; compiler/input failures emit `UNKNOWN`.

Rescan comparison keys findings by rule ID plus the protected mutation identity. A prior finding
missing in the new supported analysis is `RESOLVED`; still present is `REMAINS`; a new protected
mutation finding is `NEW`. Identical source and rule versions must produce byte-equivalent core
finding fields regardless of scan ID or run time.
