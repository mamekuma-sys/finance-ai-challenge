# 신한은행·신한금융그룹 기존 AI 서비스와 중복 위험

| 서비스 | 상태·대상 | 공개 기능 | 중복 위험 |
|---|---|---|---|
| 생성형 AI 금융지식 Q&A | 운영·고도화 | GPT·RAG 기반 자연어 금융상담. | **높음:** 일반 금융 Q&A·챗봇은 피해야 한다. ([머니투데이](https://www.mt.co.kr/tech/2025/05/12/2025051208522375410)) |
| AI 브랜치·AI 은행원 | 고도화·혁신금융서비스 | 자연어 금융상담·외국어 번역. | **높음:** AI 행원·번역 아바타는 직접 중복. ([금융위원회](https://www.fsc.go.kr/po010101/83554)) |
| AI 음성봇·보이스봇 | 운영 | 세금서류 발급, 대출 사후 안내, 상담 지원. | **높음:** 단순 음성봇은 이미 있다. ([세금서류](https://www.shinhangroup.com/kr/archive/press/detail/734), [외국인 상담](https://www.shinhangroup.com/kr/archive/press/detail/498)) |
| SOL뱅크 챗봇 | 운영 | 금융·세금서류 안내와 발급 신청. | **높음:** FAQ·메뉴 검색형 챗봇과 겹친다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/734)) |
| AI 기반 FDS·보이스피싱 공유 | 운영·고도화 | 이상거래 탐지와 그룹사 의심정보 공유. | **높음:** 거래탐지 자체는 피하고 설명·행동 안내만 검토. ([KS-SQI](https://www.shinhangroup.com/kr/archive/press/detail/831)) |
| 수출환어음 매입 AI 심사 | 운영 | OpenAI GPT 기반 수출서류 심사 자동화. | **높음:** 무역서류 OCR·심사는 피한다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/538)) |
| 법인 여신심사지원 Agent | 운영 | 기업 재무·산업동향·매입매출·담보 종합 분석, 12개 업종 엔진. | **높음:** 법인 신용분석·의견서 자동화는 피한다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/679)) |
| AI Agent 상담 예약·영업점 연계 | 운영·확대 | 선호 통화시간 분석, 음성봇 접수와 직원 상담 연결. | **중간:** 예약만 만들면 중복. 다국어 서류 준비·완료율을 차별화한다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/734)) |
| SOL Global | 운영 | 외국인 전용 16개 언어, 계좌개설·환전·대출, 가입 7→4단계. | **중간:** 앱 자체는 이미 있다. 업무 완료 오케스트레이션이 빈틈이다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/521)) |
| 외국어 상담센터 | 운영 | 12개 언어 전화상담·영업점 실시간 통역. | **중간:** 통역 챗봇은 중복. 상담 전 준비·서류 검증이 기회다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/498)) |
| 신한투자증권 AI PB | 운영 | 보유·관심 종목 기반 맞춤 뉴스·종목 분석. | **높음:** AI 투자정보·뉴스 요약은 그룹에 이미 있다. ([공식 자료](https://www.shinhangroup.com/kr/archive/press/detail/323)) |
| 신한카드 AI-SOLa·AINa | 운영 | 상담사 답변·예상 질문·표준 스크립트, 사내 업무 봇. | **중간:** 상담지원·사내 봇은 그룹 선례가 강하다. ([AI-SOLa](https://www.shinhangroup.com/kr/archive/press/detail/178), [AINa](https://www.shinhangroup.com/kr/archive/press/detail/280)) |

## 아이디어 원칙

1. “무엇이든 물어보세요”형 챗봇은 제외한다.
2. 핵심 가치는 답변 생성이 아니라 **의도 분류 → 서류·언어·채널 선택 → 단계별 실행 → 실패 시 사람 인계**로 둔다.
3. 개인 금융데이터는 쓰지 않고 공개 제도·공공 데이터와 합성 거래·서류로 데모한다.
4. 화면에는 답변 문장보다 `완료율`, `이탈 단계`, `예상 대기시간`, `사람에게 넘긴 이유`를 보여준다.
