import { summarizeTimings } from "@/lib/perf/rule0-timing";

import { OfficialLink } from "./official-link";

interface EvidencePanelProps {
  verifiedCombinations: number;
  rule0Samples: readonly number[];
  comparisonSamples: readonly number[];
}

function measurementText(samples: readonly number[]): string {
  const summary = summarizeTimings(samples);
  if (summary.sample_count === 0) {
    return "아직 측정 전 — 화면에서 선택하면 이 브라우저 세션의 실제 값이 표시됩니다.";
  }
  return `최근 ${summary.latest_ms?.toFixed(2)}ms · 표본 ${summary.sample_count}개 · p95 ${summary.p95_ms?.toFixed(2)}ms`;
}

const EVIDENCE = [
  {
    text:
      "2025년 10월~2026년 4월 보이스피싱 발생 건수는 전년 동기 14,461건에서 9,353건으로, 피해액은 7,632억 원에서 4,936억 원으로 각각 35.3% 감소했습니다. 정부는 메신저·SNS 신종 스캠의 풍선효과를 후속 과제로 제시했습니다.",
    sources: [
      {
        institution: "금융위원회",
        title: "보이스피싱 대응 성과와 후속 과제",
        url: "https://www.fsc.go.kr/po010103/86991",
      },
    ],
  },
  {
    text:
      "1회에 100만 원 이상이 송금·이체되어 입금된 경우, 입금된 때부터 해당 금액 상당액 범위에서 30분간 CD/ATM을 통한 인출·이체가 지연됩니다. 창구 거래는 즉시 가능하며, 개별 사건의 잔여 시간·회수 가능성을 뜻하지 않습니다.",
    sources: [
      {
        institution: "금융감독원",
        title: "지연인출제도 안내",
        url: "https://www.fss.or.kr/fss/main/contents.do?menuNo=200568",
      },
    ],
  },
  {
    text:
      "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
    sources: [
      {
        institution: "찾기쉬운 생활법령정보",
        title: "피해구제 신청",
        url: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=1&cnpClsNo=1&csmSeq=1592&popMenu=ov",
      },
    ],
  },
  {
    text:
      "1394 — 전기통신금융사기 통합대응단의 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계. 1332 — 금융감독원의 금융상담과 보이스피싱 피해상담·접수·구제 안내.",
    sources: [
      {
        institution: "경찰청·대한민국 정책브리핑",
        title: "전기통신금융사기 통합대응단 신고번호 1394",
        url: "https://www.korea.kr/multi/visualNewsView.do?newsId=148959173",
      },
      {
        institution: "금융위원회",
        title: "1332 보이스피싱 피해상담·구제 안내",
        url: "https://www.fsc.go.kr/no040102?cnId=913&curPage=1",
      },
    ],
  },
] as const;

export function EvidencePanel({
  verifiedCombinations,
  rule0Samples,
  comparisonSamples,
}: EvidencePanelProps) {
  return (
    <section className="evidence-panel" aria-labelledby="evidence-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">근거와 실측</p>
          <h2 id="evidence-title">왜 이 서비스인가</h2>
        </div>
        <p>
          공공 안내와 검증된 통계를 행동 설계의 근거로 사용합니다. 브라우저
          측정값은 제품 보증이 아니라 현재 세션의 관측값입니다.
        </p>
      </div>

      <div className="runtime-metrics">
        <article>
          <p>첫 행동 표시(Rule 0)</p>
          <strong>{measurementText(rule0Samples)}</strong>
          <small>이 브라우저 세션 실측값 · 목표 상한 p95 2초</small>
        </article>
        <article>
          <p>상태 전환 재구성</p>
          <strong>{measurementText(comparisonSamples)}</strong>
          <small>이 브라우저 세션 실측값 · 목표 상한 p95 5초</small>
        </article>
        <article>
          <p>결정 엔진 전수 검증</p>
          <strong>{verifiedCombinations.toLocaleString("ko-KR")} 조합 통과</strong>
          <small>테스트가 생성한 빌드 산출물에서 읽은 값</small>
        </article>
      </div>

      <ol className="evidence-list">
        {EVIDENCE.map((item, index) => (
          <li key={item.sources[0].url}>
            <div className="evidence-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <p>{item.text}</p>
              {item.sources.map((source) => (
                <OfficialLink key={source.url} href={source.url}>
                  {source.institution} · {source.title}
                </OfficialLink>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
