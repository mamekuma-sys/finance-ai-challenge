#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(appDirectory, "..");

const explicitExceptions = new Set(
  [
    "app/docs/evidence-verified.md",
    "app/docs/review-human.md",
    "app/docs/review-agent.md",
    "docs/planning/21-revision-plan-r5.md",
    "docs/planning/22-revision-plan-r6.md",
  ].map((file) => path.resolve(repositoryRoot, file)),
);

const technicalExceptions = new Set([
  path.resolve(
    appDirectory,
    "src/lib/verification/__tests__/forbidden-strings.test.ts",
  ),
]);

const exactRules = [
  "3영업일",
  "620명",
  "25.9%",
  "19.7%",
  "35.2%",
  "31.3%",
  "161명",
  "1조 2,578억",
  "23,360건",
  "2012.11",
  "2012년 11월 시행",
  "14일 안에 환급",
  "14일 내 환급 완료",
  "4명 중 1명만 30분 안에 인지",
  "4명 중 3명이 골든타임을 놓침",
  "TPL-WRITTEN-FOLLOWUP-001@1.0",
];

const measuredClaimRules = [
  {
    label: "미실측 데모 소요시간",
    pattern: /\d+(?:\.\d+)?\s*(?:초|분)\s*데모(?:\s*경로)?/gu,
  },
  {
    label: "미실측 응답시간",
    pattern:
      /(?:응답\s*시간\s*(?:약\s*)?\d+(?:\.\d+)?\s*(?:ms|초|분)|\d+(?:\.\d+)?\s*(?:ms|초|분)\s*응답\s*시간)/giu,
  },
  {
    label: "미실측 정확도",
    pattern:
      /(?:정확도\s*(?:약\s*)?\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*정확도)/gu,
  },
  {
    label: "미실측 완주율",
    pattern:
      /(?:완주율\s*(?:약\s*)?\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*완주율)/gu,
  },
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.resolve(directory, entry.name);
      return entry.isDirectory() ? filesUnder(target) : [target];
    }),
  );
  return nested.flat();
}

function relativePath(file) {
  return path.relative(repositoryRoot, file);
}

function lineNumber(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

function addExactViolations(violations, file, content) {
  for (const forbidden of exactRules) {
    let offset = content.indexOf(forbidden);
    while (offset !== -1) {
      violations.push({
        file: relativePath(file),
        line: lineNumber(content, offset),
        rule: forbidden,
      });
      offset = content.indexOf(forbidden, offset + forbidden.length);
    }
  }
}

function addMeasuredClaimViolations(violations, file, content) {
  for (const { label, pattern } of measuredClaimRules) {
    for (const match of content.matchAll(pattern)) {
      violations.push({
        file: relativePath(file),
        line: lineNumber(content, match.index),
        rule: `${label}: ${match[0]}`,
      });
    }
  }
}

const sourceFiles = await filesUnder(path.resolve(appDirectory, "src"));
const mockupFiles = (await filesUnder(path.resolve(appDirectory, "docs/mockup"))).filter(
  (file) => file.endsWith(".html") || path.basename(file) === "README.md",
);
const reportFile = path.resolve(appDirectory, "docs/w1a-report.md");

const scannedFiles = [...sourceFiles, ...mockupFiles, reportFile].filter(
  (file) =>
    !explicitExceptions.has(file) &&
    !technicalExceptions.has(file) &&
    path.resolve(file) !== path.resolve(fileURLToPath(import.meta.url)),
);

const violations = [];
for (const file of scannedFiles) {
  const content = await readFile(file, "utf8");
  addExactViolations(violations, file, content);

  if (mockupFiles.includes(file) || file === reportFile) {
    addMeasuredClaimViolations(violations, file, content);
  }

  if (mockupFiles.includes(file) && content.includes("합성 샘플")) {
    violations.push({
      file: relativePath(file),
      line: lineNumber(content, content.indexOf("합성 샘플")),
      rule: "r6 I3 미구현 기능 암시",
    });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line}: ${violation.rule}`,
    );
  }
  console.error(`금지 문자열 검사 실패: ${violations.length}건`);
  process.exitCode = 1;
} else {
  console.log(
    `금지 문자열 검사 통과: ${scannedFiles.length}개 파일, 위반 0건`,
  );
}
