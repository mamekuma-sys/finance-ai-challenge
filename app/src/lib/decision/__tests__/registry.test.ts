import { describe, expect, it } from "vitest";

import {
  TEMPLATE_REGISTRY,
  TEMPLATE_VERSIONS,
  assertTemplateRegistryComplete,
} from "@/lib/templates/registry";

import { RULES } from "../rules";
import {
  OFFICIAL_SOURCES,
  SOURCE_IDS,
  assertOfficialSourceRegistry,
} from "../sources";

const PREVIOUS_WRITTEN_FOLLOWUP_DEADLINE = ["3", "영업일"].join("");

describe("§4.7 규제 문구·공식 출처 메타데이터 게이트", () => {
  it("공식 출처 ID마다 계약 URL과 필수 메타데이터가 있다", () => {
    expect(() => assertOfficialSourceRegistry()).not.toThrow();
    expect(Object.keys(OFFICIAL_SOURCES)).toEqual([...SOURCE_IDS]);
    expect(
      Object.fromEntries(
        SOURCE_IDS.map((sourceId) => [
          sourceId,
          OFFICIAL_SOURCES[sourceId].url,
        ]),
      ),
    ).toEqual({
      "SRC-FSC-MALAPP":
        "https://www.fsc.go.kr/po010101/85338?curPage=31&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=",
      "SRC-EASYLAW-CONTACT":
        "https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=",
      "SRC-EASYLAW-STOPPAY":
        "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=1&cnpClsNo=1&csmSeq=1592&popMenu=ov",
      "SRC-FSC-10RULES": "https://www.fsc.go.kr/no010101/86250",
      "SRC-FSS-1332":
        "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572",
      "SRC-KOREA-1394":
        "https://www.korea.kr/multi/visualNewsView.do?newsId=148959173",
    });
  });

  it("모든 규칙 행의 출처·템플릿 참조가 레지스트리에 존재한다", () => {
    for (const rule of RULES) {
      for (const action of rule.actions) {
        for (const sourceId of action.source_ids) {
          expect(OFFICIAL_SOURCES[sourceId]).toBeDefined();
        }
        for (const templateVersion of action.template_versions) {
          expect(TEMPLATE_REGISTRY[templateVersion]).toBeDefined();
        }
      }
    }
  });

  it("7개 템플릿의 필수 메타데이터가 모두 채워져 있다", () => {
    expect(() => assertTemplateRegistryComplete()).not.toThrow();
    expect(Object.keys(TEMPLATE_REGISTRY)).toEqual([...TEMPLATE_VERSIONS]);
    expect(TEMPLATE_VERSIONS).toEqual([
      "TPL-SAFE-DEVICE-001@1.0",
      "TPL-BANK-STOP-001@1.0",
      "TPL-WRITTEN-FOLLOWUP-001@1.1",
      "TPL-CREDENTIAL-RECOVERY-001@1.0",
      "TPL-OFFICIAL-VERIFY-001@1.0",
      "TPL-UNDETERMINED-001@1.0",
      "TPL-PROXY-SCOPE-001@1.0",
    ]);

    for (const templateVersion of TEMPLATE_VERSIONS) {
      const template = TEMPLATE_REGISTRY[templateVersion];
      expect(
        [
          template.template_id,
          template.template_version,
          template.official_source.institution,
          template.official_source.document_title,
          template.official_source.url,
          template.source_effective_date,
          template.source_reviewed_at,
          template.next_review_at,
          template.change_log.reason,
          template.change_log.changed_by,
          template.change_log.previous_version,
          template.change_log.rollback_owner,
        ].every((value) => value.trim().length > 0),
      ).toBe(true);
      expect(template.source_effective_date).not.toBe("unknown");
      expect(template.source_reviewed_at).toBe("2026-07-25");
      expect(template.next_review_at).toBe("2026-09-01");
      if (!template.source_effective_date_confirmed) {
        expect(template.source_effective_date).toBe("2026-07-25");
      }
    }
  });

  it("법 시행일이 확인된 지급정지 템플릿만 확인 플래그를 갖는다", () => {
    expect(
      TEMPLATE_REGISTRY["TPL-BANK-STOP-001@1.0"],
    ).toMatchObject({
      source_effective_date: "2011-09-30",
      source_effective_date_confirmed: true,
    });
    expect(
      TEMPLATE_REGISTRY["TPL-WRITTEN-FOLLOWUP-001@1.1"],
    ).toMatchObject({
      source_effective_date: "2011-09-30",
      source_effective_date_confirmed: true,
      source_reviewed_at: "2026-07-25",
      official_source: {
        institution: "찾기쉬운 생활법령정보",
        document_title: "피해구제 신청",
        url: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=1&cnpClsNo=1&csmSeq=1592&popMenu=ov",
      },
      change_log: {
        reason: `법령 원문 대조: ${PREVIOUS_WRITTEN_FOLLOWUP_DEADLINE} → 신청한 날부터 3일 이내`,
        changed_by: "GoldenTime r5 개정 담당자",
        previous_version: "1.0",
        rollback_owner: "GoldenTime 운영 책임자",
      },
      body:
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다. 이어서 1394에서 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계를 안내받으세요.",
    });
  });
});
