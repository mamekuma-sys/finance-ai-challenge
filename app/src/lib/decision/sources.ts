export const SOURCE_IDS = [
  "SRC-FSC-MALAPP",
  "SRC-EASYLAW-CONTACT",
  "SRC-EASYLAW-STOPPAY",
  "SRC-FSC-10RULES",
  "SRC-FSS-1332",
  "SRC-KOREA-1394",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export interface OfficialSource {
  readonly source_id: SourceId;
  readonly institution: string;
  readonly document_title: string;
  readonly url: string;
  readonly reviewed_at: string;
}

export const OFFICIAL_SOURCES: Readonly<Record<SourceId, OfficialSource>> = {
  "SRC-FSC-MALAPP": {
    source_id: "SRC-FSC-MALAPP",
    institution: "금융위원회",
    document_title: "악성 앱 피해 대응",
    url: "https://www.fsc.go.kr/po010101/85338?curPage=31&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=",
    reviewed_at: "2026-07-25",
  },
  "SRC-EASYLAW-CONTACT": {
    source_id: "SRC-EASYLAW-CONTACT",
    institution: "찾기쉬운 생활법령정보",
    document_title: "금융사기 연락처",
    url: "https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=",
    reviewed_at: "2026-07-25",
  },
  "SRC-EASYLAW-STOPPAY": {
    source_id: "SRC-EASYLAW-STOPPAY",
    institution: "찾기쉬운 생활법령정보",
    document_title: "피해구제 신청",
    url: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=1&cnpClsNo=1&csmSeq=1592&popMenu=ov",
    reviewed_at: "2026-07-25",
  },
  "SRC-FSC-10RULES": {
    source_id: "SRC-FSC-10RULES",
    institution: "금융위원회·금융감독원",
    document_title: "보이스피싱 피해예방 10계명",
    url: "https://www.fsc.go.kr/no010101/86250",
    reviewed_at: "2026-07-25",
  },
  "SRC-FSS-1332": {
    source_id: "SRC-FSS-1332",
    institution: "금융감독원",
    document_title: "1332 안내(찾기쉬운 생활법령정보)",
    url: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572",
    reviewed_at: "2026-07-25",
  },
  "SRC-KOREA-1394": {
    source_id: "SRC-KOREA-1394",
    institution: "경찰청·대한민국 정책브리핑",
    document_title: "전기통신금융사기 통합대응단 신고번호 1394",
    url: "https://www.korea.kr/multi/visualNewsView.do?newsId=148959173",
    reviewed_at: "2026-07-25",
  },
};

export function assertOfficialSourceRegistry(): void {
  for (const sourceId of SOURCE_IDS) {
    const source = OFFICIAL_SOURCES[sourceId];
    if (
      source.source_id !== sourceId ||
      source.institution.length === 0 ||
      source.document_title.length === 0 ||
      source.url.length === 0 ||
      source.reviewed_at.length === 0
    ) {
      throw new Error(`공식 출처 메타데이터가 비었습니다: ${sourceId}`);
    }
  }
}

assertOfficialSourceRegistry();
