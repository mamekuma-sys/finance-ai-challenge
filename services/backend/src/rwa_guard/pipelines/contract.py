from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from pathlib import Path, PurePosixPath
from typing import Any, Protocol

from rwa_guard.domain.contracts import (
    CodeFinding,
    CodeLocation,
    DiffChange,
    FindingDiff,
    FindingStatus,
    Severity,
)

JsonObject = dict[str, Any]

ANALYZER_VERSION = "1.2.0"


@dataclass(frozen=True)
class RuleDefinition:
    rule_id: str
    version: str
    severity: Severity
    title: str
    required_guards: tuple[str, ...]
    mutation_kind: str


RULES = (
    RuleDefinition(
        rule_id="MINT_ACCESS_CONTROL_MISSING",
        version="1.0.0",
        severity=Severity.CRITICAL,
        title="mint 실행경로에 접근권한 검사가 없습니다.",
        required_guards=("authorization",),
        mutation_kind="mint",
    ),
    RuleDefinition(
        rule_id="MINT_COLLATERAL_CAP_MISSING",
        version="1.0.0",
        severity=Severity.CRITICAL,
        title="mint 실행경로에 담보 또는 발행한도 검사가 없습니다.",
        required_guards=("collateral_guard", "cap_guard"),
        mutation_kind="mint",
    ),
    RuleDefinition(
        rule_id="ORACLE_VALIDATION_MISSING",
        version="1.0.0",
        severity=Severity.HIGH,
        title="오라클 갱신경로에 값 또는 최신성 검사가 없습니다.",
        required_guards=("positive_answer", "not_future", "max_age"),
        mutation_kind="oracle",
    ),
)


class CompilationError(RuntimeError):
    """Raised when the submitted Solidity source set cannot produce compiler ASTs."""


@dataclass(frozen=True)
class CompiledSources:
    sources: Mapping[str, str]
    asts: tuple[JsonObject, ...]
    compiler_version: str
    forge_version: str
    original_path_by_compiler_path: Mapping[str, str]


class SolidityCompiler(Protocol):
    def compile(self, sources: Mapping[str, str]) -> CompiledSources: ...


class FoundryCompiler:
    """Compile submitted Solidity into solc ASTs using an installed Foundry toolchain."""

    def __init__(self, executable: str | None = None) -> None:
        self.executable = executable or _find_forge()

    def compile(self, sources: Mapping[str, str]) -> CompiledSources:
        if not sources:
            raise CompilationError("at least one Solidity source is required")

        normalized = {_safe_source_path(path): content for path, content in sources.items()}
        with tempfile.TemporaryDirectory(prefix="rwa-guard-solidity-") as temporary:
            root = Path(temporary)
            source_root = root / "src"
            source_root.mkdir()
            for relative_path, content in normalized.items():
                destination = source_root / relative_path
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(content, encoding="utf-8")

            (root / "foundry.toml").write_text(
                '[profile.default]\nsrc = "src"\nout = "out"\ncache_path = "cache"\n'
                'solc_version = "0.8.24"\noptimizer = false\n',
                encoding="utf-8",
            )
            command = [
                self.executable,
                "build",
                "--ast",
                "--force",
                "--offline",
                "--root",
                str(root),
            ]
            completed = subprocess.run(
                command,
                cwd=root,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60,
            )
            if completed.returncode != 0:
                message = (completed.stderr or completed.stdout).strip()
                raise CompilationError(message or "forge build failed")

            ast_by_path: dict[str, JsonObject] = {}
            compiler_version = "unknown"
            for artifact_path in sorted((root / "out").glob("**/*.json")):
                artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
                ast = artifact.get("ast")
                if isinstance(ast, dict) and isinstance(ast.get("absolutePath"), str):
                    ast_by_path[ast["absolutePath"]] = ast
                metadata = artifact.get("metadata")
                if isinstance(metadata, dict):
                    compiler = metadata.get("compiler")
                    if isinstance(compiler, dict) and isinstance(compiler.get("version"), str):
                        compiler_version = compiler["version"]

            if not ast_by_path:
                raise CompilationError("compiler completed without Solidity AST output")

            compiler_sources = {f"src/{path}": content for path, content in normalized.items()}
            original_paths = {f"src/{path}": path for path in normalized}
            return CompiledSources(
                sources=compiler_sources,
                asts=tuple(ast_by_path[path] for path in sorted(ast_by_path)),
                compiler_version=compiler_version,
                forge_version=_forge_version(self.executable),
                original_path_by_compiler_path=original_paths,
            )


RescanStatus = DiffChange


@dataclass(frozen=True)
class RescanResult:
    rule_id: str
    status: RescanStatus


@dataclass(frozen=True)
class _GuardFact:
    kind: str
    subjects: frozenset[int] = frozenset()
    state_variables: frozenset[int] = frozenset()


@dataclass(frozen=True)
class _ExecutionState:
    guards: frozenset[_GuardFact] = frozenset()
    call_path: tuple[str, ...] = ()
    unsupported: frozenset[str] = frozenset()
    bindings: tuple[tuple[int, JsonObject], ...] = ()
    binding_frames: tuple[tuple[tuple[int, JsonObject], ...], ...] = ()
    halted: bool = False
    path: tuple[str, ...] = ()


@dataclass(frozen=True)
class _Mutation:
    kind: str
    variable_id: int
    variable_name: str
    variable_category: str
    value_subjects: frozenset[int]
    node: JsonObject
    state: _ExecutionState
    entrypoint: str
    contract_name: str


def analyze_contract_sources(
    *,
    scan_id: str,
    sources: Mapping[str, str],
    target_contract: str | None = None,
    compiler: SolidityCompiler | None = None,
) -> tuple[CodeFinding, ...]:
    source_hash = _source_hash(sources)
    try:
        compiled = (compiler or FoundryCompiler()).compile(sources)
    except (CompilationError, FileNotFoundError, subprocess.SubprocessError) as error:
        return _unknown_findings(scan_id, sources, source_hash, str(error))
    return analyze_compiled_sources(
        scan_id=scan_id,
        compiled=compiled,
        target_contract=target_contract,
        source_hash=source_hash,
    )


def analyze_compiled_sources(
    *,
    scan_id: str,
    compiled: CompiledSources,
    target_contract: str | None = None,
    source_hash: str | None = None,
) -> tuple[CodeFinding, ...]:
    original_sources = {
        compiled.original_path_by_compiler_path.get(path, path): content
        for path, content in compiled.sources.items()
    }
    digest = source_hash or _source_hash(original_sources)
    analyzer = _AstAnalyzer(compiled)
    if not analyzer.has_analyzable_contract(target_contract):
        reason = (
            f"target contract not found or not analyzable: {target_contract}"
            if target_contract is not None
            else "compiler AST contains no analyzable contract"
        )
        return _unknown_findings(scan_id, original_sources, digest, reason)
    mutations = analyzer.analyze(target_contract)
    ordered_findings: list[tuple[tuple[str, str, int, str, str], CodeFinding]] = []
    emitted_paths: set[tuple[str, str, str, tuple[str, ...]]] = set()

    for mutation in mutations:
        effective_guards = analyzer.effective_guard_kinds(mutation, mutations)
        for rule in RULES:
            if mutation.kind != rule.mutation_kind:
                continue
            missing = tuple(
                guard for guard in rule.required_guards if guard not in effective_guards
            )
            if not missing:
                continue
            path_key = (
                rule.rule_id,
                mutation.contract_name,
                mutation.entrypoint,
                mutation.state.path,
            )
            if path_key in emitted_paths:
                continue
            emitted_paths.add(path_key)
            finding = _build_finding(
                scan_id=scan_id,
                compiled=compiled,
                source_hash=digest,
                mutation=mutation,
                rule=rule,
                missing=missing,
            )
            ordered_findings.append(
                (
                    (
                        finding.rule_id,
                        finding.code_location.file,
                        finding.code_location.start_line,
                        mutation.entrypoint,
                        finding.finding_id,
                    ),
                    finding,
                )
            )

    return tuple(
        finding
        for _, finding in sorted(
            ordered_findings,
            key=lambda item: item[0],
        )
    )


def compare_rescan(
    before: Sequence[CodeFinding],
    after: Sequence[CodeFinding],
    *,
    base_scan_id: str | None = None,
    head_scan_id: str | None = None,
) -> tuple[FindingDiff, ...]:
    base_id = base_scan_id or _scan_id(before, "base_scan_unknown")
    head_id = head_scan_id or _scan_id(after, "head_scan_unknown")
    base = {_finding_identity(item): item for item in before if _diff_eligible(item)}
    head = {_finding_identity(item): item for item in after if _diff_eligible(item)}
    results: list[FindingDiff] = []
    for identity in sorted(base.keys() | head.keys()):
        old = base.get(identity)
        new = head.get(identity)
        if old is not None and new is not None:
            change = DiffChange.REMAINS
            representative = new
        elif old is not None:
            change = DiffChange.RESOLVED
            representative = old
        else:
            change = DiffChange.NEW
            assert new is not None
            representative = new
        results.append(
            FindingDiff(
                finding_id=representative.finding_id,
                rule_id=representative.rule_id,
                change=change,
                base_scan_id=base_id,
                head_scan_id=head_id,
                severity=representative.severity,
                base_rule_version=_rule_version(old),
                head_rule_version=_rule_version(new),
            )
        )
    return tuple(results)


def _scan_id(findings: Sequence[CodeFinding], fallback: str) -> str:
    return findings[0].scan_id if findings else fallback


def _rule_version(finding: CodeFinding | None) -> str | None:
    return finding.tool_versions.get("rule") if finding is not None else None


def _diff_eligible(finding: CodeFinding) -> bool:
    return finding.status is FindingStatus.CONFIRMED


def _finding_identity(finding: CodeFinding) -> tuple[str, str, int, int, str, str | None]:
    location = finding.code_location
    return (
        finding.rule_id,
        location.file,
        location.start_line,
        location.end_line,
        finding.title,
        _rule_version(finding),
    )


class _AstAnalyzer:
    def __init__(self, compiled: CompiledSources) -> None:
        self.compiled = compiled
        self.nodes: dict[int, JsonObject] = {}
        self.parent_contract: dict[int, JsonObject] = {}
        self.contracts: dict[int, JsonObject] = {}
        self.functions: dict[int, JsonObject] = {}
        self.modifiers: dict[int, JsonObject] = {}
        self.state_variables: dict[int, str] = {}
        self.path_by_source_id: dict[int, str] = {}
        self.mutations: list[_Mutation] = []
        self.active_contract: JsonObject | None = None
        for ast in compiled.asts:
            source_id = _source_id(ast)
            path = ast.get("absolutePath")
            if source_id is not None and isinstance(path, str):
                self.path_by_source_id[source_id] = path
            self._index(ast, None)

    def has_analyzable_contract(self, target_contract: str | None) -> bool:
        return any(
            contract.get("contractKind") == "contract"
            and not contract.get("abstract", False)
            and (target_contract is None or contract.get("name") == target_contract)
            for contract in self.contracts.values()
        )

    def analyze(self, target_contract: str | None) -> tuple[_Mutation, ...]:
        contracts = [
            contract
            for contract in self.contracts.values()
            if contract.get("contractKind") == "contract" and not contract.get("abstract", False)
        ]
        if target_contract is not None:
            contracts = [
                contract for contract in contracts if contract.get("name") == target_contract
            ]
            if not contracts:
                raise ValueError(f"target contract not found: {target_contract}")

        for contract in sorted(
            contracts, key=lambda item: (str(item.get("name")), int(item["id"]))
        ):
            self.active_contract = contract
            for function in self._entrypoints(contract):
                label = f"{contract['name']}.{_function_signature(function)}"
                initial = _ExecutionState(call_path=(label,))
                mutation_start = len(self.mutations)
                final_states = self._execute_function(
                    function,
                    [initial],
                    entrypoint=label,
                    contract_name=str(contract["name"]),
                    stack=(),
                    append_label=False,
                )
                if not final_states:
                    del self.mutations[mutation_start:]
                    continue
                entry_mutations = [
                    mutation
                    for mutation in self.mutations[mutation_start:]
                    if any(
                        final_state.path[: len(mutation.state.path)] == mutation.state.path
                        for final_state in final_states
                    )
                ]
                self.mutations[mutation_start:] = entry_mutations
                global_reasons = frozenset(
                    reason
                    for mutation in entry_mutations
                    for reason in mutation.state.unsupported
                    if reason == "recursive internal call"
                    or reason.startswith("unresolved function or dynamic call")
                )
                if global_reasons:
                    self.mutations[mutation_start:] = [
                        replace(
                            mutation,
                            state=replace(
                                mutation.state,
                                unsupported=mutation.state.unsupported | global_reasons,
                            ),
                        )
                        for mutation in entry_mutations
                    ]
        supply_entries = {
            (mutation.contract_name, mutation.entrypoint)
            for mutation in self.mutations
            if mutation.kind == "mint" and mutation.variable_category == "supply"
        }
        oracle_entries = {
            (mutation.contract_name, mutation.entrypoint)
            for mutation in self.mutations
            if mutation.kind == "oracle"
            and mutation.variable_category in {"oracle_answer", "oracle_timestamp"}
        }
        return tuple(
            mutation
            for mutation in self.mutations
            if not (
                mutation.kind == "mint"
                and mutation.variable_category in {"balance", "unclassified_mint_state"}
                and (mutation.contract_name, mutation.entrypoint) in supply_entries
            )
            and not (
                mutation.kind == "oracle"
                and mutation.variable_category == "unclassified_oracle_state"
                and (mutation.contract_name, mutation.entrypoint) in oracle_entries
            )
        )

    def effective_guard_kinds(
        self, mutation: _Mutation, mutations: Sequence[_Mutation]
    ) -> frozenset[str]:
        kinds: set[str] = set()
        oracle_group = [
            candidate
            for candidate in mutations
            if candidate.kind == "oracle"
            and candidate.contract_name == mutation.contract_name
            and candidate.entrypoint == mutation.entrypoint
            and candidate.state.path == mutation.state.path
        ]
        answer_subjects = frozenset(
            subject
            for candidate in oracle_group
            if candidate.variable_category == "oracle_answer"
            for subject in candidate.value_subjects
        )
        timestamp_subjects = frozenset(
            subject
            for candidate in oracle_group
            if candidate.variable_category == "oracle_timestamp"
            for subject in candidate.value_subjects
        )
        for fact in mutation.state.guards:
            if fact.kind == "cap_guard":
                if mutation.variable_id not in fact.state_variables:
                    continue
                if mutation.value_subjects and not mutation.value_subjects.issubset(fact.subjects):
                    continue
            elif fact.kind == "positive_answer":
                if not answer_subjects or not answer_subjects.issubset(fact.subjects):
                    continue
            elif fact.kind in {"not_future", "max_age"}:
                if not timestamp_subjects or not timestamp_subjects.issubset(fact.subjects):
                    continue
            kinds.add(fact.kind)
        return frozenset(kinds)

    def _index(self, node: Any, contract: JsonObject | None) -> None:
        if isinstance(node, list):
            for child in node:
                self._index(child, contract)
            return
        if not isinstance(node, dict):
            return
        current_contract = contract
        node_id = node.get("id")
        node_type = node.get("nodeType")
        if node_type == "ContractDefinition" and isinstance(node_id, int):
            current_contract = node
            self.contracts[node_id] = node
        if isinstance(node_id, int):
            self.nodes[node_id] = node
            if current_contract is not None:
                self.parent_contract[node_id] = current_contract
        if node_type == "FunctionDefinition" and isinstance(node_id, int):
            self.functions[node_id] = node
        elif node_type == "ModifierDefinition" and isinstance(node_id, int):
            self.modifiers[node_id] = node
        elif (
            node_type == "VariableDeclaration"
            and node.get("stateVariable") is True
            and isinstance(node_id, int)
        ):
            self.state_variables[node_id] = str(node.get("name", ""))
        for value in node.values():
            if isinstance(value, (dict, list)):
                self._index(value, current_contract)

    def _entrypoints(self, contract: JsonObject) -> tuple[JsonObject, ...]:
        linearized = contract.get("linearizedBaseContracts", [contract["id"]])
        functions: list[JsonObject] = []
        signatures: set[str] = set()
        for contract_id in linearized:
            base = self.contracts.get(contract_id)
            if base is None:
                continue
            for node in base.get("nodes", []):
                if not isinstance(node, dict) or node.get("nodeType") != "FunctionDefinition":
                    continue
                if node.get("kind") != "function" or node.get("visibility") not in {
                    "public",
                    "external",
                }:
                    continue
                signature = _function_signature(node)
                if signature not in signatures:
                    signatures.add(signature)
                    functions.append(node)
        return tuple(functions)

    def _resolve_function(self, declaration: int) -> JsonObject | None:
        function = self.functions.get(declaration)
        if function is None or function.get("visibility") == "private":
            return function
        return self._resolve_override(
            function,
            nodes=self.functions,
            node_type="FunctionDefinition",
            base_key="baseFunctions",
        )

    def _resolve_modifier(self, declaration: int) -> JsonObject | None:
        modifier = self.modifiers.get(declaration)
        if modifier is None:
            return None
        return self._resolve_override(
            modifier,
            nodes=self.modifiers,
            node_type="ModifierDefinition",
            base_key="baseModifiers",
        )

    def _resolve_override(
        self,
        declaration: JsonObject,
        *,
        nodes: Mapping[int, JsonObject],
        node_type: str,
        base_key: str,
    ) -> JsonObject:
        if self.active_contract is None:
            return declaration
        declaration_id = int(declaration["id"])
        signature = _callable_signature(declaration)
        for contract_id in self.active_contract.get("linearizedBaseContracts", []):
            contract = self.contracts.get(contract_id)
            if contract is None:
                continue
            for candidate in contract.get("nodes", []):
                if (
                    not isinstance(candidate, dict)
                    or candidate.get("nodeType") != node_type
                    or _callable_signature(candidate) != signature
                    or not isinstance(candidate.get("body"), dict)
                ):
                    continue
                if self._overrides_declaration(
                    candidate,
                    declaration_id=declaration_id,
                    nodes=nodes,
                    base_key=base_key,
                ):
                    return candidate
        return declaration

    @staticmethod
    def _overrides_declaration(
        candidate: JsonObject,
        *,
        declaration_id: int,
        nodes: Mapping[int, JsonObject],
        base_key: str,
    ) -> bool:
        pending = [int(candidate["id"])]
        visited: set[int] = set()
        while pending:
            current_id = pending.pop()
            if current_id == declaration_id:
                return True
            if current_id in visited:
                continue
            visited.add(current_id)
            current = nodes.get(current_id, {})
            pending.extend(
                base_id for base_id in current.get(base_key, []) if isinstance(base_id, int)
            )
        return False

    def _execute_function(
        self,
        function: JsonObject,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
        append_label: bool = True,
    ) -> list[_ExecutionState]:
        function_id = int(function["id"])
        if function_id in stack:
            return [self._unsupported(state, "recursive internal call") for state in states]
        original_depths = [len(state.call_path) for state in states]
        if append_label:
            label = _node_label(function, self.parent_contract)
            states = [replace(state, call_path=(*state.call_path, label)) for state in states]

        next_stack = (*stack, function_id)
        resolved_modifiers: list[tuple[JsonObject, JsonObject]] = []
        for invocation in function.get("modifiers", []):
            modifier_id = _referenced_declaration(invocation.get("modifierName"))
            modifier = self._resolve_modifier(modifier_id)
            if modifier is None:
                states = [self._unsupported(state, "unresolved modifier") for state in states]
                continue
            resolved_modifiers.append((modifier, invocation))
            suffix = self._modifier_suffix(modifier)
            if suffix and _statements_always_revert(suffix):
                return []
            states = self._execute_modifier_prefix(
                modifier,
                invocation,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=next_stack,
            )

        if any(self._modifier_suffix(modifier) for modifier, _ in resolved_modifiers):
            states = [
                self._unsupported(state, "modifier postlude affects commit semantics")
                for state in states
            ]

        body = function.get("body")
        if isinstance(body, dict):
            states = self._execute_block(
                body,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=next_stack,
            )

        if append_label:
            restored: list[_ExecutionState] = []
            fallback_depth = original_depths[0] if original_depths else 0
            for state in states:
                restored.append(replace(state, call_path=state.call_path[:fallback_depth]))
            return restored
        return states

    @staticmethod
    def _modifier_suffix(modifier: JsonObject) -> list[Any]:
        body = modifier.get("body")
        if not isinstance(body, dict):
            return []
        statements = body.get("statements", [])
        placeholder_index = next(
            (
                index
                for index, statement in enumerate(statements)
                if isinstance(statement, dict)
                and statement.get("nodeType") == "PlaceholderStatement"
            ),
            None,
        )
        if placeholder_index is None:
            return []
        return list(statements[placeholder_index + 1 :])

    def _execute_modifier_prefix(
        self,
        modifier: JsonObject,
        invocation: JsonObject,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        body = modifier.get("body")
        if not isinstance(body, dict):
            return [self._unsupported(state, "modifier without body") for state in states]
        statements = body.get("statements", [])
        placeholder_index = next(
            (
                index
                for index, statement in enumerate(statements)
                if isinstance(statement, dict)
                and statement.get("nodeType") == "PlaceholderStatement"
            ),
            None,
        )
        if placeholder_index is None:
            return [self._unsupported(state, "modifier without continuation") for state in states]
        label = _node_label(modifier, self.parent_contract)
        original_depth = len(states[0].call_path) if states else 0
        states = self._bind_states(modifier, invocation.get("arguments", []), states)
        states = [replace(state, call_path=(*state.call_path, label)) for state in states]
        states = self._execute_statements(
            statements[:placeholder_index],
            states,
            entrypoint=entrypoint,
            contract_name=contract_name,
            stack=stack,
        )
        states = [replace(state, call_path=state.call_path[:original_depth]) for state in states]
        return self._restore_bindings(states)

    def _execute_block(
        self,
        block: JsonObject,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        return self._execute_statements(
            block.get("statements", []),
            states,
            entrypoint=entrypoint,
            contract_name=contract_name,
            stack=stack,
        )

    def _execute_statements(
        self,
        statements: Iterable[Any],
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        current = states
        for statement in statements:
            if not isinstance(statement, dict) or not current:
                continue
            halted = [state for state in current if state.halted]
            active = [state for state in current if not state.halted]
            if not active:
                continue
            current = halted + self._execute_statement(
                statement,
                active,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
        return current

    def _execute_statement(
        self,
        statement: JsonObject,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        node_type = statement.get("nodeType")
        if node_type in {"Block", "UncheckedBlock"}:
            return self._execute_block(
                statement,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
        if node_type == "RevertStatement":
            return []
        if node_type == "Return":
            expression = statement.get("expression")
            if isinstance(expression, dict):
                states = self._execute_expression(
                    expression,
                    states,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                    stack=stack,
                )
            return [replace(state, halted=True) for state in states]
        if node_type == "InlineAssembly":
            states = [self._unsupported(state, "inline assembly") for state in states]
            self._record_unsupported_entry_mutation(statement, states, entrypoint, contract_name)
            return states
        if node_type == "IfStatement":
            condition = statement.get("condition", {})
            states = self._mark_guard_expression_calls(condition, states)
            true_body = statement.get("trueBody")
            false_body = statement.get("falseBody")
            branch_id = str(statement.get("src", "unknown"))
            true_states = self._add_condition_guards(
                [replace(state, path=(*state.path, f"{branch_id}:true")) for state in states],
                condition,
                truth=True,
            )
            false_states = self._add_condition_guards(
                [replace(state, path=(*state.path, f"{branch_id}:false")) for state in states],
                condition,
                truth=False,
            )
            true_states = self._execute_optional_body(
                true_body,
                true_states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
            false_states = self._execute_optional_body(
                false_body,
                false_states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
            return [*true_states, *false_states]
        if node_type == "VariableDeclarationStatement":
            return self._bind_local_declaration(statement, states)
        if node_type == "ExpressionStatement":
            expression = statement.get("expression")
            if isinstance(expression, dict):
                if (
                    expression.get("nodeType") == "FunctionCall"
                    and _call_name(expression.get("expression")) == "revert"
                ):
                    return []
                return self._execute_expression(
                    expression,
                    states,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                    stack=stack,
                )
        if node_type in {"TryStatement", "WhileStatement", "ForStatement", "DoWhileStatement"}:
            states = [self._unsupported(state, f"unsupported {node_type}") for state in states]
            self._record_unsupported_entry_mutation(statement, states, entrypoint, contract_name)
            return states
        return states

    def _execute_optional_body(
        self,
        body: Any,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        if body is None:
            return list(states)
        if not isinstance(body, dict):
            return [self._unsupported(state, "unresolved branch") for state in states]
        mutation_start = len(self.mutations)
        executed = self._execute_statement(
            body,
            list(states),
            entrypoint=entrypoint,
            contract_name=contract_name,
            stack=stack,
        )
        if not executed:
            del self.mutations[mutation_start:]
        return executed

    def _execute_expression(
        self,
        expression: JsonObject,
        states: list[_ExecutionState],
        *,
        entrypoint: str,
        contract_name: str,
        stack: tuple[int, ...],
    ) -> list[_ExecutionState]:
        node_type = expression.get("nodeType")
        if node_type in {"Assignment", "UnaryOperation"}:
            left = expression.get("leftHandSide") or expression.get("subExpression")
            declaration = _base_variable_declaration(left)
            if declaration not in self.state_variables:
                return self._update_local_binding(expression, declaration, states)
            self._record_mutation(expression, states, entrypoint, contract_name)
            return states
        if node_type != "FunctionCall":
            return states

        called = expression.get("expression")
        called_name = _call_name(called)
        if called_name in {"require", "assert"}:
            arguments = expression.get("arguments", [])
            if not arguments:
                return states
            condition = arguments[0]
            states = self._mark_guard_expression_calls(condition, states)
            surviving: list[_ExecutionState] = []
            for state in states:
                expanded = self._expand_expression(condition, state)
                if _literal_boolean(expanded) is False:
                    continue
                guards = self._guard_facts(expanded, truth=True, state=state)
                surviving.append(replace(state, guards=state.guards | guards))
            return surviving

        declaration = _referenced_declaration(called)
        function = self._resolve_function(declaration)
        if function is not None and not (
            isinstance(called, dict) and called.get("nodeType") == "MemberAccess"
        ):
            bound_states = self._bind_states(function, expression.get("arguments", []), states)
            executed = self._execute_function(
                function,
                bound_states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
            resumed = [replace(state, halted=False) for state in executed]
            return self._restore_bindings(resumed)
        if isinstance(called, dict) and called.get("nodeType") == "MemberAccess":
            states = [
                self._unsupported(state, f"external or dynamic call: {called_name}")
                for state in states
            ]
            if called_name in {"delegatecall", "callcode"}:
                self._record_unsupported_entry_mutation(
                    expression, states, entrypoint, contract_name
                )
            return states
        if declaration >= 0:
            return [
                self._unsupported(state, f"unresolved function or dynamic call: {called_name}")
                for state in states
            ]
        return states

    def _bind_local_declaration(
        self, statement: JsonObject, states: list[_ExecutionState]
    ) -> list[_ExecutionState]:
        declarations = [
            declaration
            for declaration in statement.get("declarations", [])
            if isinstance(declaration, dict) and isinstance(declaration.get("id"), int)
        ]
        initial = statement.get("initialValue")
        if len(declarations) != 1 or not isinstance(initial, dict):
            return [
                self._unsupported(state, "unresolved local declaration or tuple assignment")
                for state in states
            ]
        declaration_id = int(declarations[0]["id"])
        bound: list[_ExecutionState] = []
        for state in states:
            bindings = dict(state.bindings)
            bindings[declaration_id] = self._expand_expression(initial, state)
            bound.append(
                replace(
                    state,
                    bindings=tuple(sorted(bindings.items())),
                )
            )
        return bound

    @staticmethod
    def _restore_bindings(states: list[_ExecutionState]) -> list[_ExecutionState]:
        restored: list[_ExecutionState] = []
        for state in states:
            if not state.binding_frames:
                restored.append(state)
                continue
            restored.append(
                replace(
                    state,
                    bindings=state.binding_frames[-1],
                    binding_frames=state.binding_frames[:-1],
                )
            )
        return restored

    def _update_local_binding(
        self,
        expression: JsonObject,
        declaration: int,
        states: list[_ExecutionState],
    ) -> list[_ExecutionState]:
        if declaration < 0 or expression.get("nodeType") != "Assignment":
            return [self._unsupported(state, "unresolved local mutation") for state in states]
        if expression.get("operator") != "=":
            return [self._unsupported(state, "compound local mutation") for state in states]
        right = expression.get("rightHandSide")
        if not isinstance(right, dict):
            return [self._unsupported(state, "unresolved local assignment") for state in states]
        updated: list[_ExecutionState] = []
        for state in states:
            bindings = dict(state.bindings)
            bindings[declaration] = self._expand_expression(right, state)
            updated.append(replace(state, bindings=tuple(sorted(bindings.items()))))
        return updated

    def _bind_states(
        self,
        callable_node: JsonObject,
        arguments: Sequence[Any],
        states: list[_ExecutionState],
    ) -> list[_ExecutionState]:
        parameters = callable_node.get("parameters", {}).get("parameters", [])
        bound: list[_ExecutionState] = []
        for state in states:
            bindings = dict(state.bindings)
            for parameter, argument in zip(parameters, arguments, strict=False):
                parameter_id = parameter.get("id") if isinstance(parameter, dict) else None
                if isinstance(parameter_id, int) and isinstance(argument, dict):
                    bindings[parameter_id] = self._expand_expression(argument, state)
            bound.append(
                replace(
                    state,
                    bindings=tuple(sorted(bindings.items())),
                    binding_frames=(*state.binding_frames, state.bindings),
                )
            )
        return bound

    def _add_condition_guards(
        self,
        states: list[_ExecutionState],
        expression: Any,
        *,
        truth: bool,
    ) -> list[_ExecutionState]:
        return [
            replace(
                state,
                guards=state.guards | self._guard_facts(expression, truth=truth, state=state),
            )
            for state in states
        ]

    def _mark_guard_expression_calls(
        self, expression: Any, states: list[_ExecutionState]
    ) -> list[_ExecutionState]:
        reasons = self._guard_call_reasons(expression)
        if not reasons:
            return states
        return [replace(state, unsupported=state.unsupported | reasons) for state in states]

    def _guard_call_reasons(self, expression: Any) -> frozenset[str]:
        reasons: set[str] = set()

        def visit(node: Any) -> None:
            if isinstance(node, list):
                for child in node:
                    visit(child)
                return
            if not isinstance(node, dict):
                return
            if node.get("nodeType") == "FunctionCall":
                called = node.get("expression")
                called_name = _call_name(called)
                declaration = _referenced_declaration(called)
                if isinstance(called, dict) and called.get("nodeType") == "MemberAccess":
                    reasons.add(f"external or dynamic guard call: {called_name}")
                elif declaration in self.functions:
                    reasons.add(f"boolean-return guard helper: {called_name}")
                else:
                    reasons.add(f"unresolved guard call or type conversion: {called_name}")
            for value in node.values():
                if isinstance(value, (dict, list)):
                    visit(value)

        visit(expression)
        return frozenset(reasons)

    def _guard_facts(
        self, expression: Any, *, truth: bool, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        if not isinstance(expression, dict):
            return frozenset()
        expression = self._expand_expression(expression, state)
        if self._guard_call_reasons(expression):
            return frozenset()
        node_type = expression.get("nodeType")
        if node_type == "UnaryOperation" and expression.get("operator") == "!":
            return self._guard_facts(expression.get("subExpression"), truth=not truth, state=state)
        if node_type == "BinaryOperation" and expression.get("operator") in {"&&", "||"}:
            operator = expression["operator"]
            if (operator == "&&" and truth) or (operator == "||" and not truth):
                left = self._guard_facts(expression.get("leftExpression"), truth=truth, state=state)
                right = self._guard_facts(
                    expression.get("rightExpression"), truth=truth, state=state
                )
                return left | right
            return frozenset()

        atom_facts = self._boolean_atom_facts(expression, truth=truth, state=state)
        if node_type != "BinaryOperation":
            return atom_facts
        operator = expression.get("operator")
        if not isinstance(operator, str):
            return atom_facts
        effective_operator = operator if truth else _NEGATED_COMPARISON.get(operator)
        if effective_operator is None:
            return atom_facts
        left = expression.get("leftExpression")
        right = expression.get("rightExpression")

        boolean = _literal_boolean(right)
        if boolean is not None and effective_operator in {"==", "!="}:
            required_truth = boolean if effective_operator == "==" else not boolean
            atom_facts |= self._boolean_atom_facts(left, truth=required_truth, state=state)
        boolean = _literal_boolean(left)
        if boolean is not None and effective_operator in {"==", "!="}:
            required_truth = boolean if effective_operator == "==" else not boolean
            atom_facts |= self._boolean_atom_facts(right, truth=required_truth, state=state)

        facts = set(atom_facts)
        if effective_operator == "==":
            if self._contains_msg_sender(left) and self._authority_state_refs(right, state):
                facts.add(_GuardFact("authorization"))
            if self._contains_msg_sender(right) and self._authority_state_refs(left, state):
                facts.add(_GuardFact("authorization"))

        facts.update(self._positive_answer_facts(left, effective_operator, right, state))
        facts.update(
            self._positive_answer_facts(right, _SWAPPED_COMPARISON[effective_operator], left, state)
        )
        facts.update(self._not_future_facts(left, effective_operator, right, state))
        facts.update(
            self._not_future_facts(right, _SWAPPED_COMPARISON[effective_operator], left, state)
        )
        facts.update(self._max_age_facts(left, effective_operator, right, state))
        facts.update(
            self._max_age_facts(right, _SWAPPED_COMPARISON[effective_operator], left, state)
        )
        facts.update(self._cap_facts(left, effective_operator, right, state))
        facts.update(self._cap_facts(right, _SWAPPED_COMPARISON[effective_operator], left, state))
        return frozenset(facts)

    def _boolean_atom_facts(
        self, expression: Any, *, truth: bool, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        if not truth or not isinstance(expression, dict):
            return frozenset()
        expression = self._expand_expression(expression, state)
        facts: set[_GuardFact] = set()
        if self._is_role_check(expression, state):
            facts.add(_GuardFact("authorization"))
        collateral = self._semantic_state_refs(
            expression,
            state,
            required=("collateral",),
            any_of=("verified", "active", "ready"),
        )
        if collateral:
            facts.add(_GuardFact("collateral_guard", state_variables=collateral))
        return frozenset(facts)

    def _positive_answer_facts(
        self, subject: Any, operator: str, boundary: Any, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        subjects = self._value_refs(subject, state, ("answer", "price"))
        literal = _literal_integer(boundary)
        if not subjects or literal is None:
            return frozenset()
        proven = (operator == ">" and literal >= 0) or (operator == ">=" and literal >= 1)
        return (
            frozenset({_GuardFact("positive_answer", subjects=subjects)}) if proven else frozenset()
        )

    def _not_future_facts(
        self, timestamp: Any, operator: str, clock: Any, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        subjects = self._value_refs(timestamp, state, ("updatedat", "timestamp", "observedat"))
        if subjects and operator in {"<", "<="} and self._is_block_timestamp(clock):
            return frozenset({_GuardFact("not_future", subjects=subjects)})
        return frozenset()

    def _max_age_facts(
        self, age: Any, operator: str, maximum: Any, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        if operator not in {"<", "<="}:
            return frozenset()
        max_age = self._semantic_state_refs(maximum, state, required=("maxage",), any_of=())
        if not max_age or not isinstance(age, dict):
            return frozenset()
        age = self._expand_expression(age, state)
        if age.get("nodeType") != "BinaryOperation" or age.get("operator") != "-":
            return frozenset()
        if not self._is_block_timestamp(age.get("leftExpression")):
            return frozenset()
        subjects = self._value_refs(
            age.get("rightExpression"), state, ("updatedat", "timestamp", "observedat")
        )
        if not subjects:
            return frozenset()
        return frozenset({_GuardFact("max_age", subjects=subjects, state_variables=max_age)})

    def _cap_facts(
        self, post_supply: Any, operator: str, maximum: Any, state: _ExecutionState
    ) -> frozenset[_GuardFact]:
        if operator not in {"<", "<="}:
            return frozenset()
        cap_variables = self._semantic_state_refs(
            maximum, state, required=(), any_of=("maxsupply", "supplycap", "issuancelimit")
        )
        if not cap_variables or not isinstance(post_supply, dict):
            return frozenset()
        post_supply = self._expand_expression(post_supply, state)
        if post_supply.get("nodeType") != "BinaryOperation" or post_supply.get("operator") != "+":
            return frozenset()
        left = post_supply.get("leftExpression")
        right = post_supply.get("rightExpression")
        supply = self._semantic_state_refs(left, state, required=("supply",), any_of=())
        amount = self._non_state_refs(right, state)
        if not supply or not amount:
            supply = self._semantic_state_refs(right, state, required=("supply",), any_of=())
            amount = self._non_state_refs(left, state)
        if not supply or not amount:
            return frozenset()
        return frozenset({_GuardFact("cap_guard", subjects=amount, state_variables=supply)})

    def _is_role_check(self, expression: JsonObject, state: _ExecutionState) -> bool:
        if expression.get("nodeType") == "IndexAccess":
            role_variables = self._semantic_state_refs(
                expression.get("baseExpression"),
                state,
                required=(),
                any_of=("role", "allowlist", "minter", "authorized", "approved"),
            )
            return bool(role_variables) and self._contains_msg_sender(
                expression.get("indexExpression")
            )
        return False

    def _authority_state_refs(self, expression: Any, state: _ExecutionState) -> frozenset[int]:
        return self._semantic_state_refs(
            expression,
            state,
            required=(),
            any_of=("issuer", "owner", "admin", "authority"),
        )

    def _semantic_state_refs(
        self,
        expression: Any,
        state: _ExecutionState,
        *,
        required: tuple[str, ...],
        any_of: tuple[str, ...],
    ) -> frozenset[int]:
        references = self._canonical_declarations(expression, state)
        return frozenset(
            declaration
            for declaration in references
            if declaration in self.state_variables
            and all(
                token in _normalize_name(self.state_variables[declaration]) for token in required
            )
            and (
                not any_of
                or any(
                    token in _normalize_name(self.state_variables[declaration]) for token in any_of
                )
            )
        )

    def _value_refs(
        self, expression: Any, state: _ExecutionState, names: tuple[str, ...]
    ) -> frozenset[int]:
        return frozenset(
            declaration
            for declaration in self._canonical_declarations(expression, state)
            if declaration not in self.state_variables
            and any(token in self._declaration_name(declaration) for token in names)
        )

    def _non_state_refs(self, expression: Any, state: _ExecutionState) -> frozenset[int]:
        return frozenset(
            declaration
            for declaration in self._canonical_declarations(expression, state)
            if declaration not in self.state_variables and declaration >= 0
        )

    def _canonical_declarations(self, expression: Any, state: _ExecutionState) -> frozenset[int]:
        expanded = self._expand_expression(expression, state)
        references: set[int] = set()

        def visit(node: Any) -> None:
            if isinstance(node, list):
                for child in node:
                    visit(child)
                return
            if not isinstance(node, dict):
                return
            declaration = node.get("referencedDeclaration")
            if isinstance(declaration, int) and declaration >= 0:
                references.add(declaration)
            for value in node.values():
                if isinstance(value, (dict, list)):
                    visit(value)

        visit(expanded)
        return frozenset(references)

    def _expand_expression(self, expression: JsonObject, state: _ExecutionState) -> JsonObject:
        bindings = dict(state.bindings)

        def expand(node: Any, stack: frozenset[int]) -> Any:
            if isinstance(node, list):
                return [expand(child, stack) for child in node]
            if not isinstance(node, dict):
                return node
            declaration = node.get("referencedDeclaration")
            if (
                isinstance(declaration, int)
                and declaration in bindings
                and declaration not in stack
            ):
                return expand(bindings[declaration], stack | {declaration})
            return {
                key: expand(value, stack) if isinstance(value, (dict, list)) else value
                for key, value in node.items()
            }

        expanded = expand(expression, frozenset())
        return expanded if isinstance(expanded, dict) else expression

    def _declaration_name(self, declaration: int) -> str:
        node = self.nodes.get(declaration, {})
        return _normalize_name(str(node.get("name", "")))

    @staticmethod
    def _contains_msg_sender(expression: Any) -> bool:
        if isinstance(expression, list):
            return any(_AstAnalyzer._contains_msg_sender(item) for item in expression)
        if not isinstance(expression, dict):
            return False
        if (
            expression.get("nodeType") == "MemberAccess"
            and expression.get("memberName") == "sender"
        ):
            base = expression.get("expression")
            if isinstance(base, dict) and base.get("name") == "msg":
                return True
        return any(_AstAnalyzer._contains_msg_sender(value) for value in expression.values())

    @staticmethod
    def _is_block_timestamp(expression: Any) -> bool:
        return (
            isinstance(expression, dict)
            and expression.get("nodeType") == "MemberAccess"
            and expression.get("memberName") == "timestamp"
            and isinstance(expression.get("expression"), dict)
            and expression["expression"].get("name") == "block"
        )

    def _record_mutation(
        self,
        expression: JsonObject,
        states: list[_ExecutionState],
        entrypoint: str,
        contract_name: str,
    ) -> None:
        left = expression.get("leftHandSide") or expression.get("subExpression")
        variable_id = _base_variable_declaration(left)
        variable_name = self.state_variables.get(variable_id, "")
        normalized = _normalize_name(variable_name)
        for state in states:
            entrypoint_name = _normalize_name(entrypoint.rsplit(".", 1)[-1])
            kind: str | None = None
            category = ""
            mutation_state = state
            if "supply" in normalized or (
                "balance" in normalized
                and any(token in entrypoint_name for token in ("mint", "issue"))
            ):
                increase = self._increase_status(expression, variable_id, state)
                if increase is False:
                    continue
                if increase is None:
                    mutation_state = self._unsupported(
                        state, "unresolved protected supply assignment direction"
                    )
                kind = "mint"
                category = "supply" if "supply" in normalized else "balance"
            elif any(token in normalized for token in ("answer", "price")):
                kind = "oracle"
                category = "oracle_answer"
            elif any(token in normalized for token in ("updatedat", "timestamp", "observedat")):
                kind = "oracle"
                category = "oracle_timestamp"
            elif variable_id in self.state_variables and any(
                token in entrypoint_name for token in ("mint", "issue")
            ):
                increase = self._increase_status(expression, variable_id, state)
                if increase is False:
                    continue
                kind = "mint"
                category = "unclassified_mint_state"
                mutation_state = self._unsupported(state, "unclassified mint-like state mutation")
            elif variable_id in self.state_variables and any(
                token in entrypoint_name for token in ("oracle", "price", "update")
            ):
                kind = "oracle"
                category = "unclassified_oracle_state"
                mutation_state = self._unsupported(state, "unclassified oracle-like state mutation")
            if kind is None:
                continue
            value = expression.get("rightHandSide") or expression.get("subExpression")
            self.mutations.append(
                _Mutation(
                    kind=kind,
                    variable_id=variable_id,
                    variable_name=variable_name,
                    variable_category=category,
                    value_subjects=self._non_state_refs(value, state),
                    node=expression,
                    state=mutation_state,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                )
            )

    def _increase_status(
        self, expression: JsonObject, variable_id: int, state: _ExecutionState
    ) -> bool | None:
        if expression.get("nodeType") == "UnaryOperation":
            operator = expression.get("operator")
            if operator == "++":
                return True
            if operator == "--":
                return False
            return None
        operator = expression.get("operator")
        if operator == "+=":
            return True
        if operator in {"-=", "/=", "%="}:
            return False
        if operator == "*=":
            return None
        if operator != "=":
            return None
        right = self._expand_expression(expression.get("rightHandSide", {}), state)
        if right.get("nodeType") != "BinaryOperation":
            return None
        if right.get("operator") == "+" and variable_id in self._canonical_declarations(
            right, state
        ):
            return True
        if right.get("operator") == "-" and variable_id in self._canonical_declarations(
            right, state
        ):
            return False
        return None

    def _record_unsupported_entry_mutation(
        self,
        node: JsonObject,
        states: list[_ExecutionState],
        entrypoint: str,
        contract_name: str,
    ) -> None:
        normalized_entrypoint = _normalize_name(entrypoint)
        kind: str | None = None
        if any(token in normalized_entrypoint for token in ("mint", "issue")):
            kind = "mint"
        elif any(token in normalized_entrypoint for token in ("oracle", "update", "price")):
            kind = "oracle"
        if kind is None:
            return
        for state in states:
            self.mutations.append(
                _Mutation(
                    kind=kind,
                    variable_id=-1,
                    variable_name="unsupported_dynamic_state",
                    variable_category="unsupported",
                    value_subjects=frozenset(),
                    node=node,
                    state=state,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                )
            )

    @staticmethod
    def _unsupported(state: _ExecutionState, reason: str) -> _ExecutionState:
        return replace(state, unsupported=state.unsupported | {reason})


def _build_finding(
    *,
    scan_id: str,
    compiled: CompiledSources,
    source_hash: str,
    mutation: _Mutation,
    rule: RuleDefinition,
    missing: tuple[str, ...],
) -> CodeFinding:
    location, offset = _location(compiled, mutation.node)
    identity = "|".join(
        (
            rule.rule_id,
            rule.version,
            source_hash,
            location.file,
            mutation.entrypoint,
            str(offset),
        )
    )
    finding_hash = hashlib.sha256(identity.encode()).hexdigest()[:20]
    guard_evidence = [
        f"guard.{guard}={'missing' if guard in missing else 'present'}"
        for guard in rule.required_guards
    ]
    status = FindingStatus.NEEDS_REVIEW if mutation.state.unsupported else FindingStatus.CONFIRMED
    evidence = [
        "analysis=solc_ast_control_flow",
        f"entrypoint={mutation.entrypoint}",
        f"call_path={' -> '.join(mutation.state.call_path)}",
        f"protected_mutation={location.file}:{location.start_line}",
        *guard_evidence,
    ]
    evidence.extend(f"unsupported={reason}" for reason in sorted(mutation.state.unsupported))
    return CodeFinding(
        scan_id=scan_id,
        finding_id=f"finding_{finding_hash}",
        rule_id=rule.rule_id,
        severity=rule.severity,
        status=status,
        title=rule.title,
        source_hash=source_hash,
        code_location=location,
        deterministic_evidence=evidence,
        tool_versions={
            "rwa_guard_contract": ANALYZER_VERSION,
            "rule": rule.version,
            "solc": compiled.compiler_version,
            "forge": compiled.forge_version,
        },
    )


def _unknown_findings(
    scan_id: str, sources: Mapping[str, str], source_hash: str, reason: str
) -> tuple[CodeFinding, ...]:
    first_path = sorted(sources)[0] if sources else "input.sol"
    first_line = sources.get(first_path, "").splitlines()[0] if sources.get(first_path) else ""
    findings = []
    for rule in RULES:
        identity = f"{rule.rule_id}|{rule.version}|{source_hash}|unknown"
        findings.append(
            CodeFinding(
                scan_id=scan_id,
                finding_id=f"finding_{hashlib.sha256(identity.encode()).hexdigest()[:20]}",
                rule_id=rule.rule_id,
                severity=rule.severity,
                status=FindingStatus.UNKNOWN,
                title=f"컴파일 또는 AST 생성 실패로 {rule.rule_id}를 판정할 수 없습니다.",
                source_hash=source_hash,
                code_location=CodeLocation(
                    file=first_path,
                    start_line=1,
                    end_line=1,
                    excerpt=first_line,
                ),
                deterministic_evidence=[f"compile_error={reason[:500]}"],
                tool_versions={
                    "rwa_guard_contract": ANALYZER_VERSION,
                    "rule": rule.version,
                    "solc": "unavailable",
                },
            )
        )
    return tuple(findings)


def _location(compiled: CompiledSources, node: JsonObject) -> tuple[CodeLocation, int]:
    offset, length, source_id = _parse_src(str(node.get("src", "0:0:-1")))
    compiler_path = next(
        (
            ast.get("absolutePath")
            for ast in compiled.asts
            if _source_id(ast) == source_id and isinstance(ast.get("absolutePath"), str)
        ),
        "unknown.sol",
    )
    assert isinstance(compiler_path, str)
    source = compiled.sources.get(compiler_path, "")
    encoded = source.encode("utf-8")
    safe_offset = min(offset, len(encoded))
    safe_end = min(offset + max(length, 1), len(encoded))
    start_line = encoded[:safe_offset].count(b"\n") + 1
    end_line = encoded[:safe_end].count(b"\n") + 1
    lines = source.splitlines()
    excerpt = "\n".join(lines[start_line - 1 : end_line]) if lines else ""
    original_path = compiled.original_path_by_compiler_path.get(compiler_path, compiler_path)
    return (
        CodeLocation(
            file=original_path,
            start_line=start_line,
            end_line=max(start_line, end_line),
            excerpt=excerpt,
        ),
        offset,
    )


_NEGATED_COMPARISON = {
    "==": "!=",
    "!=": "==",
    ">": "<=",
    ">=": "<",
    "<": ">=",
    "<=": ">",
}

_SWAPPED_COMPARISON = {
    "==": "==",
    "!=": "!=",
    ">": "<",
    ">=": "<=",
    "<": ">",
    "<=": ">=",
}


def _literal_boolean(node: Any) -> bool | None:
    if not isinstance(node, dict) or node.get("nodeType") != "Literal":
        return None
    value = node.get("value")
    if value == "true":
        return True
    if value == "false":
        return False
    return None


def _literal_integer(node: Any) -> int | None:
    if not isinstance(node, dict) or node.get("nodeType") != "Literal":
        return None
    value = node.get("value")
    if not isinstance(value, str):
        return None
    try:
        return int(value, 0)
    except ValueError:
        return None


def _base_variable_declaration(node: Any) -> int:
    if not isinstance(node, dict):
        return -1
    declaration = node.get("referencedDeclaration")
    if isinstance(declaration, int):
        return declaration
    for key in ("baseExpression", "expression", "subExpression", "leftHandSide"):
        nested = _base_variable_declaration(node.get(key))
        if nested != -1:
            return nested
    return -1


def _statements_always_revert(statements: Sequence[Any]) -> bool:
    if not statements:
        return False
    last = statements[-1]
    if not isinstance(last, dict):
        return False
    if last.get("nodeType") == "RevertStatement":
        return True
    if last.get("nodeType") == "ExpressionStatement":
        expression = last.get("expression")
        return isinstance(expression, dict) and _call_name(expression.get("expression")) == "revert"
    return False


def _call_name(node: Any) -> str:
    if not isinstance(node, dict):
        return "unknown"
    value = node.get("name") or node.get("memberName")
    return str(value) if value else "unknown"


def _referenced_declaration(node: Any) -> int:
    if not isinstance(node, dict):
        return -1
    value = node.get("referencedDeclaration")
    return value if isinstance(value, int) else -1


def _node_label(node: JsonObject, parents: Mapping[int, JsonObject]) -> str:
    parent = parents.get(int(node["id"]), {})
    return f"{parent.get('name', 'unknown')}.{node.get('name') or node.get('kind', 'unknown')}"


def _function_signature(function: JsonObject) -> str:
    return _callable_signature(function)


def _callable_signature(callable_node: JsonObject) -> str:
    parameters = callable_node.get("parameters", {}).get("parameters", [])
    types = [
        str(parameter.get("typeDescriptions", {}).get("typeString", "?"))
        for parameter in parameters
    ]
    return f"{callable_node.get('name')}({','.join(types)})"


def _parse_src(src: str) -> tuple[int, int, int]:
    parts = src.split(":")
    if len(parts) != 3:
        return 0, 0, -1
    return int(parts[0]), int(parts[1]), int(parts[2])


def _source_id(ast: JsonObject) -> int | None:
    try:
        return _parse_src(str(ast.get("src", "")))[2]
    except ValueError:
        return None


def _source_hash(sources: Mapping[str, str]) -> str:
    digest = hashlib.sha256()
    for path in sorted(sources):
        digest.update(PurePosixPath(path).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(sources[path].encode("utf-8"))
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def _safe_source_path(path: str) -> str:
    normalized = PurePosixPath(path)
    if normalized.is_absolute() or ".." in normalized.parts or normalized.suffix != ".sol":
        raise CompilationError(f"unsafe Solidity source path: {path}")
    return normalized.as_posix()


def _find_forge() -> str:
    configured = os.environ.get("RWA_GUARD_FORGE_BIN")
    foundry_home = Path.home() / ".foundry" / "bin"
    candidates = [
        configured,
        shutil.which("forge"),
        str(foundry_home / "forge.exe"),
        str(foundry_home / "forge"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise FileNotFoundError("forge not found; install Foundry or set RWA_GUARD_FORGE_BIN")


def _forge_version(executable: str) -> str:
    completed = subprocess.run(
        [executable, "--version"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=10,
    )
    first_line = (completed.stdout or completed.stderr).splitlines()
    return first_line[0].strip() if first_line else "unknown"


def _normalize_name(name: str) -> str:
    return "".join(character for character in name.lower() if character.isalnum())
