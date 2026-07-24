import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const THIS_TEST_FILE = path.resolve(fileURLToPath(import.meta.url));
const FORBIDDEN_STRINGS = [
  "3영업일",
  "620명",
  "25.9%",
  "19.7%",
  "161명",
  "1조 2,578억",
  "23,360건",
  "2012.11 시행",
  "2012년 11월 시행",
  "14일 안에 환급",
  "14일 내 환급 완료",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(target);
    }
    return entry.isFile() && statSync(target).isFile() ? [target] : [];
  });
}

describe("r5 금지 문자열 소스 트리 게이트", () => {
  it("정확히 이 테스트 파일만 제외하고 app/src 전체를 검사한다", () => {
    expect(THIS_TEST_FILE.startsWith(`${SOURCE_ROOT}${path.sep}`)).toBe(true);

    const scannedFiles = sourceFiles(SOURCE_ROOT).filter(
      (file) => file !== THIS_TEST_FILE,
    );
    expect(scannedFiles).not.toContain(THIS_TEST_FILE);
    expect(scannedFiles.length).toBeGreaterThan(0);

    const violations = scannedFiles.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return FORBIDDEN_STRINGS.filter((forbidden) =>
        content.includes(forbidden),
      ).map((forbidden) => ({
        file: path.relative(process.cwd(), file),
        forbidden,
      }));
    });

    expect(violations).toEqual([]);
  });
});
