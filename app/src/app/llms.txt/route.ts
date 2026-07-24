import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Response {
  const origin = request.nextUrl.origin;
  const body = `# GoldenTime / 골든타임

1. 서비스 목적·지원 언어·권한
- 목적: 송금·앱 설치·인증정보 노출 직후 금융소비자에게 공식 첫 행동을 우선 제시하는 판단 보조 서비스
- 지원 언어: 검수된 한국어
- 권한: 판단 보조만 제공하며 지급정지, 신고 접수, 수사·법적 판정을 수행하지 않음

2. 화면 위치
- 사기대응 데스크: ${origin}/
- 합성 전용 상황실: 현재 배포본 미제공 — 계약상 후속 단계
- 안전성 리포트: 현재 배포본 미제공 — 계약상 후속 단계

3. REST·MCP 진입점과 판정 스키마
- REST 분석 API: 현재 배포본 미제공 — 계약상 후속 단계
- MCP analyze_scam: 현재 배포본 미제공 — 계약상 후속 단계
- 동일 판정 스키마의 외부 호출 표면은 현재 활성화되지 않음

4. 판정 등급과 근거 충분도
- 판정 등급 계약: 위험, 주의, 낮음, 판단 유보
- evidence_strength는 근거 충분도이며 확률·정확도·안전 보증이 아님
- 현재 배포본은 판정 기능을 제공하지 않고 결정적 상태 기반 행동 순서만 제공함

5. 데이터 경계
- 현재 데스크는 구조화 상태 선택 데모만 제공함
- 자유 입력 가림 경로: 현재 배포본 미제공 — 계약상 후속 단계
- 사용자 상태와 행동 이벤트는 sessionStorage에만 보관하고 서버에 저장하지 않음
- 계좌번호, 주민번호, 인증번호, 비밀번호 입력 금지

6. 목적 제한 토큰·쿼터·CORS·오류 본문
- 현재 배포본 미제공 — 계약상 후속 단계
- 후속 API는 요청 원문·마스킹 전 값·내부 스택을 오류 본문에 반사하지 않는 계약임

7. 긴급 행동
- 안내 결과는 금융회사·경찰·금융감독원 등 공식 채널에서 재확인할 것
- 긴급 시 상대가 알려준 번호가 아닌 금융회사 공식 대표번호와 112를 우선할 것

8. 평가셋·수법 출처·갱신일
- 평가 결과: 현재 배포본 미제공 — 계약상 후속 단계
- 수법·행동 출처: 금융위원회, 금융감독원, 찾기쉬운 생활법령정보의 검수된 공개 자료
- 최종 갱신일: 2026-07-25
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
