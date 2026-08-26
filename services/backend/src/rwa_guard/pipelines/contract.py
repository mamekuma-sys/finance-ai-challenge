from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Any, Protocol

from rwa_guard.domain.contracts import CodeFinding, CodeLocation, FindingStatus, Severity

JsonObject = dict[str, Any]

ANALYZER_VERSION = "1.0.0"


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


class RescanStatus(StrEnum):
    RESOLVED = "RESOLVED"
    REMAINS = "REMAINS"
    NEW = "NEW"


@dataclass(frozen=True)
class RescanResult:
    rule_id: str
    status: RescanStatus


@dataclass(frozen=True)
class _ExecutionState:
    guards: frozenset[str] = frozenset()
    call_path: tuple[str, ...] = ()
    unsupported: frozenset[str] = frozenset()


@dataclass(frozen=True)
class _Mutation:
    kind: str
    variable_name: str
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
    analyzer = _AstAnalyzer(compiled)
    mutations = analyzer.analyze(target_contract)
    digest = source_hash or _source_hash(
        {
            compiled.original_path_by_compiler_path.get(path, path): content
            for path, content in compiled.sources.items()
        }
    )
    findings: list[CodeFinding] = []

    for mutation in mutations:
        for rule in RULES:
            if mutation.kind != rule.mutation_kind:
                continue
            missing = tuple(
                guard for guard in rule.required_guards if guard not in mutation.state.guards
            )
            if not missing:
                continue
            findings.append(
                _build_finding(
                    scan_id=scan_id,
                    compiled=compiled,
                    source_hash=digest,
                    mutation=mutation,
                    rule=rule,
                    missing=missing,
                )
            )

    findings.sort(
        key=lambda finding: (
            finding.rule_id,
            finding.code_location.file,
            finding.code_location.start_line,
            finding.finding_id,
        )
    )
    return tuple(findings)


def compare_rescan(
    before: Sequence[CodeFinding], after: Sequence[CodeFinding]
) -> tuple[RescanResult, ...]:
    before_rules = {
        finding.rule_id for finding in before if finding.status is FindingStatus.CONFIRMED
    }
    after_rules = {
        finding.rule_id for finding in after if finding.status is FindingStatus.CONFIRMED
    }
    results = [
        RescanResult(
            rule_id=rule_id,
            status=(RescanStatus.REMAINS if rule_id in after_rules else RescanStatus.RESOLVED),
        )
        for rule_id in sorted(before_rules)
    ]
    results.extend(
        RescanResult(rule_id=rule_id, status=RescanStatus.NEW)
        for rule_id in sorted(after_rules - before_rules)
    )
    return tuple(results)


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
        for ast in compiled.asts:
            source_id = _source_id(ast)
            path = ast.get("absolutePath")
            if source_id is not None and isinstance(path, str):
                self.path_by_source_id[source_id] = path
            self._index(ast, None)

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
            for function in self._entrypoints(contract):
                label = f"{contract['name']}.{function.get('name') or function.get('kind')}"
                initial = _ExecutionState(call_path=(label,))
                self._execute_function(
                    function,
                    [initial],
                    entrypoint=label,
                    contract_name=str(contract["name"]),
                    stack=(),
                    append_label=False,
                )
        supply_entries = {
            (mutation.contract_name, mutation.entrypoint)
            for mutation in self.mutations
            if mutation.kind == "mint" and "supply" in _normalize_name(mutation.variable_name)
        }
        return tuple(
            mutation
            for mutation in self.mutations
            if not (
                mutation.kind == "mint"
                and "balance" in _normalize_name(mutation.variable_name)
                and (mutation.contract_name, mutation.entrypoint) in supply_entries
            )
        )

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
        for invocation in function.get("modifiers", []):
            modifier_id = _referenced_declaration(invocation.get("modifierName"))
            modifier = self.modifiers.get(modifier_id)
            if modifier is None:
                states = [self._unsupported(state, "unresolved modifier") for state in states]
                continue
            states = self._execute_modifier_prefix(
                modifier,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=next_stack,
            )

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

    def _execute_modifier_prefix(
        self,
        modifier: JsonObject,
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
        states = [replace(state, call_path=(*state.call_path, label)) for state in states]
        states = self._execute_statements(
            statements[:placeholder_index],
            states,
            entrypoint=entrypoint,
            contract_name=contract_name,
            stack=stack,
        )
        return [replace(state, call_path=state.call_path[:original_depth]) for state in states]

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
            current = self._execute_statement(
                statement,
                current,
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
        if node_type == "Block":
            return self._execute_block(
                statement,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
        if node_type in {"RevertStatement", "Return"}:
            return []
        if node_type == "InlineAssembly":
            states = [self._unsupported(state, "inline assembly") for state in states]
            self._record_unsupported_entry_mutation(statement, states, entrypoint, contract_name)
            return states
        if node_type == "IfStatement":
            condition = statement.get("condition", {})
            true_body = statement.get("trueBody")
            false_body = statement.get("falseBody")
            if _terminates(true_body) and false_body is None:
                guards = _classify_guards(condition)
                return [replace(state, guards=state.guards | guards) for state in states]
            if _terminates(false_body):
                guards = _classify_guards(condition)
                return [replace(state, guards=state.guards | guards) for state in states]
            true_states = self._execute_optional_body(
                true_body,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
            false_states = self._execute_optional_body(
                false_body,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
            return [*true_states, *false_states]
        if node_type == "ExpressionStatement":
            expression = statement.get("expression")
            if isinstance(expression, dict):
                return self._execute_expression(
                    expression,
                    states,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                    stack=stack,
                )
        if node_type in {"TryStatement", "WhileStatement", "ForStatement", "DoWhileStatement"}:
            return [self._unsupported(state, f"unsupported {node_type}") for state in states]
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
        return self._execute_statement(
            body,
            list(states),
            entrypoint=entrypoint,
            contract_name=contract_name,
            stack=stack,
        )

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
            self._record_mutation(expression, states, entrypoint, contract_name)
            return states
        if node_type != "FunctionCall":
            return states

        called = expression.get("expression")
        called_name = _call_name(called)
        if called_name in {"require", "assert"}:
            arguments = expression.get("arguments", [])
            guards = _classify_guards(arguments[0]) if arguments else frozenset()
            return [replace(state, guards=state.guards | guards) for state in states]

        declaration = _referenced_declaration(called)
        function = self.functions.get(declaration)
        if function is not None and function.get("visibility") in {"internal", "private"}:
            return self._execute_function(
                function,
                states,
                entrypoint=entrypoint,
                contract_name=contract_name,
                stack=stack,
            )
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
        return states

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
        call_names = " ".join(
            state_part.lower() for state in states for state_part in state.call_path
        )
        kind: str | None = None
        if "supply" in normalized or (
            "balance" in normalized and any(token in call_names for token in ("mint", "issue"))
        ):
            kind = "mint"
        elif normalized in {"answer", "price", "oracleanswer", "oracleprice"}:
            kind = "oracle"
        if kind is None:
            return
        for state in states:
            self.mutations.append(
                _Mutation(
                    kind=kind,
                    variable_name=variable_name,
                    node=expression,
                    state=state,
                    entrypoint=entrypoint,
                    contract_name=contract_name,
                )
            )

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
                    variable_name="unsupported_dynamic_state",
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


def _classify_guards(expression: Any) -> frozenset[str]:
    names: set[str] = set()
    operators: set[str] = set()
    literals: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, list):
            for child in node:
                visit(child)
            return
        if not isinstance(node, dict):
            return
        for key in ("name", "memberName"):
            value = node.get(key)
            if isinstance(value, str):
                names.add(_normalize_name(value))
        operator = node.get("operator")
        if isinstance(operator, str):
            operators.add(operator)
        value = node.get("value")
        if node.get("nodeType") == "Literal" and isinstance(value, str):
            literals.add(value)
        for value in node.values():
            if isinstance(value, (dict, list)):
                visit(value)

    visit(expression)
    guards: set[str] = set()
    has_sender = "msg" in names and "sender" in names
    has_authority = any(
        any(token in name for token in ("issuer", "owner", "admin", "role", "allowlist"))
        for name in names
    )
    if has_sender and has_authority:
        guards.add("authorization")
    if any("collateral" in name for name in names):
        guards.add("collateral_guard")
    has_supply = any("supply" in name for name in names)
    has_cap = any("max" in name or "cap" in name for name in names)
    if has_supply and has_cap and operators & {">", ">=", "<", "<="}:
        guards.add("cap_guard")
    has_answer = any("answer" in name or name == "price" for name in names)
    if has_answer and "0" in literals and operators & {">", ">=", "<", "<="}:
        guards.add("positive_answer")
    has_block_timestamp = "block" in names and "timestamp" in names
    has_updated_at = any("updatedat" in name or "timestamp" in name for name in names)
    if has_block_timestamp and has_updated_at and operators & {">", ">=", "<", "<="}:
        guards.add("not_future")
    if has_block_timestamp and has_updated_at and any("maxage" in name for name in names):
        guards.add("max_age")
    return frozenset(guards)


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


def _terminates(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    if node.get("nodeType") in {"RevertStatement", "Return"}:
        return True
    if node.get("nodeType") == "Block":
        statements = node.get("statements", [])
        return bool(statements) and _terminates(statements[-1])
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
    parameters = function.get("parameters", {}).get("parameters", [])
    types = [
        str(parameter.get("typeDescriptions", {}).get("typeString", "?"))
        for parameter in parameters
    ]
    return f"{function.get('name')}({','.join(types)})"


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
    candidates = [configured, shutil.which("forge"), str(Path.home() / ".foundry/bin/forge")]
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
        timeout=10,
    )
    first_line = (completed.stdout or completed.stderr).splitlines()
    return first_line[0].strip() if first_line else "unknown"


def _normalize_name(name: str) -> str:
    return "".join(character for character in name.lower() if character.isalnum())
