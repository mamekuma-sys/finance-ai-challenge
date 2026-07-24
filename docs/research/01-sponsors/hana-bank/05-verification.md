# 하나은행 리서치 검증

검증 기준일: 2026-07-24. 원문 5개 파일의 동일·반복 주장은 한 행으로 묶었고, 원문에 인용된 고유 URL 27개를 직접 열어 본문·게시일·주체·수치를 대조했다. 원문 URL 가운데 확인된 404는 없었으나, 인용 명칭이 실제 매체와 다르거나 해당 페이지가 주장한 수치를 담지 않은 경우는 `🔗링크문제`로 판정했다. MVP 기간·언어 수·데모 시간처럼 외부 사실이 아니라 작성자의 설계 가정인 숫자도 누락하지 않고 `❓확인불가`로 분리했다.

## 1. 요약 판정

**전체 신뢰도: 중.** 재무, 하나원큐 이용자 수, 하나은행 영업점 수, 외국인 취업자 수, 주요 AI·지원사업의 날짜와 규모는 대체로 출처와 일치했다. 다만 업계 점포 수 감소 수치는 인용 페이지가 전혀 뒷받침하지 않고, 그룹 순이익 링크의 매체 귀속과 외국인 금융 기사 날짜도 틀렸다. 더 중요한 문제는 후보 아이디어의 중복 검토가 최신 공식 서비스를 빠뜨렸다는 점이다. Hana EZ는 원문이 전제한 단순 번역·송금 앱보다 훨씬 넓은 기능을 이미 제공하고, `하나원큐 길라잡이`와 `하나더소호`의 매장분석·AI 컨설팅도 각각 후보 2·3과 부분 중복된다.

검증한 주장 묶음은 **37건**이며, 판정은 **✅확인 26건 / ⚠️불일치 6건 / 🔗링크문제 2건 / ❓확인불가 3건**이다.

## 2. 주장별 검증 표

| 파일 | 주장(핵심 숫자) | 인용 출처 | 판정 | 비고·수정안 |
|---|---|---|---|---|
| `00-overview.md` | “총자산 509조 9,230억원, 2024년 말 은행계정” | [KIS Credit Opinion](https://m.kisrating.com/fileDown.do?fileName=rs20250630-44.pdf&gubun=2&menuCd=R8) | ✅확인 | PDF 표의 2024.12 총자산 `509,923`십억원과 일치한다. 각주도 은행계정 기준임을 명시한다. |
| `00-overview.md` | “당기순이익 3조 1,270억원, 2024년 은행계정” | [KIS Credit Opinion](https://m.kisrating.com/fileDown.do?fileName=rs20250630-44.pdf&gubun=2&menuCd=R8) | ✅확인 | PDF 표의 당기순이익 `3,127`십억원과 일치한다. |
| `00-overview.md` | “하나금융그룹 2025년 연결 당기순이익 4조 29억원”을 “연합뉴스TV 인용 보도”로 표기 | [다음 뉴스](https://v.daum.net/v/0DZGfrgRjB) | 🔗링크문제 | 숫자 자체는 본문과 일치하지만 실제 매체는 **뉴스웨이**이며 연합뉴스TV가 아니다. 출처명을 “뉴스웨이(다음 재게시)”로 고치거나 [하나금융그룹 2025 Annual Report](https://www.hanafn.com/ir/annualReport.do)로 교체해야 한다. |
| `00-overview.md`, `01-news.md`, `02-pain-points.md` | “하나원큐 가입자 1,790만명, MAU 461만명, 25.8%” | [KB Think의 연합인포맥스 기사](https://kbthink.com/news-list/view.html?newsId=20260507090747436) | ✅확인 | 2026-05-07 기사에 모바일인덱스 기준 세 수치가 모두 그대로 나온다. `25.8%`도 `461÷1,790`과 일치한다. 다만 가입자와 월간 이용자는 정의가 다른 지표이므로 이를 곧바로 “비활성 고객 비율 74.2%”로 해석해서는 안 된다. |
| `00-overview.md`, `02-pain-points.md`, `04-candidates.md` | “하나은행 2025년 말 608개; 593→597→602→608” | [EBN의 다음 재게시 기사](https://v.daum.net/v/pR8Ku5kLZi?f=p) | ✅확인 | 기사에 2022~2025년 `593→597→602→608`, 2026년 2월 `610`이 명시돼 있다. 산업단지·일요영업점 운영도 확인된다. |
| `00-overview.md`, `02-pain-points.md`, `04-candidates.md` | “2024년 5월 국내 취업 외국인 근로자 100만명 초과” | [전자신문](https://www.etnews.com/20250523000054) | ✅확인 | 기사와 통계청 원자료 모두 `101만명`을 뒷받침한다. 더 정확한 표현은 **“2024년 5월 기준 15세 이상 국내 상주 외국인 취업자 101만명”**이다. “근로자”보다 범위가 넓은 “취업자”를 쓰는 편이 안전하다. |
| `00-overview.md`, `02-pain-points.md`, `03-existing-ai.md`, `04-candidates.md` | “하나원큐 200개국 이상 송금·27개 통화 외환시장” | [하나원큐 Google Play](https://play.google.com/store/apps/details?id=com.hanabank.oqf) | ✅확인 | 공식 앱 설명에 `200개국 이상`, 외환시장 `27개 통화`, 환전지갑이 명시돼 있다. |
| `00-overview.md`, `03-existing-ai.md`, `04-candidates.md` | “Hana EZ 운영, 하나원큐와 Hana EZ 간 이동 개선” | [하나원큐 Google Play](https://play.google.com/store/apps/details?id=com.hanabank.oqf), [하나은행 외환 FAQ](https://www.hanabank.co.kr/cont/customer/customer01/customer0102/customer010204/index.jsp), [2019 Hana EZ 약관](https://image.kebhana.com/cont/download/documents/provide/0000002019085_20190718.pdf) | ✅확인 | 서비스 존재와 하나원큐 내 Hana EZ 이동 개선은 확인된다. 다만 2019년 약관은 현재 기능 범위를 판단하기에는 낡았다. 최신 기능 비교에는 [Hana EZ 공식 앱 설명](https://play.google.com/store/apps/details?hl=ko&id=com.kebhana.hanasfbank)을 사용해야 한다. |
| `00-overview.md`, `02-pain-points.md`, `04-candidates.md` | “업계 점포 2019년 말 6,738개→2025년 9월 말 5,523개” | [EBN의 다음 재게시 기사](https://v.daum.net/v/pR8Ku5kLZi?f=p) | 🔗링크문제 | 인용 페이지에는 `6,738`, `5,523`, `2019년` 수치가 없다. 감소 방향과 개별 수치는 다른 자료에서 확인되지만 이 링크로는 검증되지 않는다. 1차 자료에 맞춰 **“2020년 말 6,427개→2025년 9월 말 5,523개, 904개·14.1% 감소”**로 고치고 [금융위원회 대응방안](https://fsc.go.kr/po010101/86201?curPage=5&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=)을 인용하는 것이 안전하다. |
| `00-overview.md`, `02-pain-points.md`, `04-candidates.md` | “시니어 전용 라운지·전담 상담 확대; 65세 이상을 취약 소비자로 명시” | [매일경제](https://m.mk.co.kr/amp/12033606), [하나은행 상품판매 준칙](https://banking.kebhana.com/cont/customer/customer04/customer0409/index.jsp) | ✅확인 | 매일경제는 시니어 라운지 확대 계획을, 준칙은 `65세 이상 고령층`을 취약 소비자로 명시한다. 이는 **하나은행 고객 중 고령층 비중**을 입증하는 통계는 아니다. |
| `01-news.md` | 제목은 “최근 12개월”, 본문은 “2025-07-24 이후 우선” | 파일 내 날짜와 각 기사 게시일 | ⚠️불일치 | 기준일 2026-07-24의 최근 12개월 범위 밖인 `2025-06-17`, `2025-05-22` 기사가 포함됐다. 제목을 “주요 AI·디지털 뉴스”로 바꾸거나 두 행을 별도 “참고: 12개월 이전” 섹션으로 옮겨야 한다. |
| `01-news.md`, `03-existing-ai.md` | “AI 연금투자 인출기 2025-12-31 출시; 2026년 1분기 비대면 확대 계획” | [하나금융융합기술원](https://hit.hanati.co.kr/ko/about/press/view?seq=69) | ✅확인 | 게시일, 개인형 IRP 대상 기능, 2026년 1분기 하나원큐·인터넷뱅킹 확대 계획이 모두 일치한다. 확대는 당시 **계획**이지 완료 실적은 아니다. |
| `01-news.md` | “2025-11-06 디지털자산·AI 양대 축; 100조원 프로젝트” | [하나금융융합기술원](https://hit.hanati.co.kr/ko/about/press/view?seq=68) | ✅확인 | 날짜와 서비스 사례는 일치한다. 단, `100조원`은 AI 투자액이 아니라 5년간 생산적·포용금융을 포함한 **하나 모두 성장 프로젝트 전체 규모**다. |
| `01-news.md` | “2025-08-13 키관리 솔루션, TTA 11개 항목 통과” | [하나금융융합기술원](https://hit.hanati.co.kr/ko/about/press/view?seq=67) | ✅확인 | 전자지갑·인증·다중서명 기능과 TTA `11개` 시험항목 통과가 본문과 일치한다. |
| `01-news.md` | “2025-07-28 지역·점포별 판매 가점; 유언대용신탁·하나 더 넥스트·내집연금” | [아주경제](https://www.ajunews.com/view/20250728150348257) | ✅확인 | 게시일과 언급된 상품·점포별 판매전략이 일치한다. |
| `01-news.md`, `03-existing-ai.md` | “2026-03-18 AI 여신심사를 전 영업점 도입” | [뉴스와이어](https://www.newswire.co.kr/newsRead.php?no=1030500) | ✅확인 | 게시일과 전 영업점 도입이 확인된다. 기사에는 심사의견 초안 작성 시간이 약 `30분→10초`, 연 `7만건`, 연 `2만7천시간` 절감 전망도 제시된다. |
| `01-news.md` | “2026-03-16 인프라펀드 5,000억원, 하나은행 4,000억원” | [이데일리](https://marketin.edaily.co.kr/News/ReadE?newsId=02745366645383976) | ✅확인 | 총 `5,000억원`과 하나은행 출자 `4,000억원`, AI 데이터·컴퓨팅센터 투자 대상이 일치한다. |
| `01-news.md` | “2025-12-21 AI 여신심사로 업무량 30% 감소” | [서울경제](https://mv2.sedaily.com/NewsView/2H1TFXZC2J/GC07) | ✅확인 | 기사에 `업무량 30% 감소`가 나오지만 당시의 **예상 효과**다. 측정된 사후 실적으로 표현하지 않아야 한다. |
| `01-news.md` | “2025년까지 데이터 인재 2,500명; 2025년 상반기 2,486명” | [이데일리 원문 URL](https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=03102886642296512) | ✅확인 | 기사 ID가 같은 [정상 열람 URL](https://marketin.edaily.co.kr/News/ReadE?newsId=03102886642296512)에서 목표 `2,500명`, 상반기 `2,486명`을 확인했다. |
| `01-news.md`, `02-pain-points.md`, `04-candidates.md` | “2025년 소상공인 1,000개 사업장, 사업장별 최대 200만원” | [이데일리](https://marketin.edaily.co.kr/News/ReadE?newsId=03102886642264368) | ✅확인 | `1,000개소`, 최대 `200만원`, 배리어프리 키오스크·AI CCTV·QR오더 등 지원 품목이 일치한다. 이는 **2025년 사업** 수치다. |
| `01-news.md`, `03-existing-ai.md` | “2025-06-17 직원용 지식챗봇에 생성형 AI 도입” | [뉴시스](https://www.newsis.com/view/NISX20250617_0003216295) | ✅확인 | 날짜, 자체 생성형 AI, 최신 규정과 출처 제공 기능이 일치한다. |
| `01-news.md`, `03-existing-ai.md` | “2025-05-22 생성형 AI 아이부자 장래희망 사진전” | [전자신문](https://www.etnews.com/20250522000124) | ✅확인 | 게시일과 자녀 사진·장래희망을 결합한 이미지 생성 이벤트가 일치한다. |
| `01-news.md`, `02-pain-points.md`, `04-candidates.md` | 아시아경제 기사 날짜를 “2026-05-19”로 표기 | [아시아경제](https://view.asiae.co.kr/article/2026051917460307267) | ⚠️불일치 | URL 식별자에는 `20260519`가 들어가지만 페이지의 실제 입력일은 **2026-05-21**이다. 날짜를 2026-05-21로 수정해야 한다. 언어·서류·수수료 장벽 내용은 확인된다. |
| `02-pain-points.md` | “구 하나원큐 평점 4.2, 리뷰 3.48만개; 2025 해외 네트워크 오류·2026 Toss/휴대폰 인증 실패 리뷰” | [구 하나원큐 Google Play](https://play.google.com/store/apps/details?hl=en-US&id=com.kebhana.hanapush) | ✅확인 | 영문 페이지의 평점 영역과 해당 날짜의 리뷰 문구를 직접 확인했다. 다만 평점·리뷰 수는 지역·시점에 따라 변하는 동적 수치이므로 **조회일 스냅샷**으로만 써야 한다. 소수의 리뷰만으로 전체 외국인 고객의 대표 문제라고 일반화할 수는 없다. |
| `03-existing-ai.md` | “HAI 상담지원봇이 실시간 요약·분류와 처리절차 안내” | [하나금융융합기술원](https://hit.hanati.co.kr/ko/about/press/view?seq=66) | ✅확인 | 실시간 상담 요약·자동분류, 업무정보·처리절차 제공, 향후 지식 추천 계획이 모두 명시돼 있다. |
| `03-existing-ai.md` | “AI Wealth·AI 자산관리·AI Quant 등 보유” | [하나금융융합기술원 연혁](https://hit.hanati.co.kr/ko/about) | ✅확인 | 연혁에서 AI Wealth, AI 자산관리, AI Quant 관련 연구·서비스 이력을 확인했다. |
| `03-existing-ai.md`, `04-candidates.md` | “2024년 AI 정책자금 맞춤조회 출시, 자체 일치율로 매칭” | [하나금융융합기술원 연혁](https://hit.hanati.co.kr/ko/about) | ✅확인 | 연혁과 [2024-01-15 공식 보도자료](https://hit.hanati.co.kr/m/ko/about/press/view?seq=55)가 서비스, 일치율, 정책자금 매칭을 뒷받침한다. 보도자료에는 `3만2천여 고객군·198개 상품` 분석도 나온다. |
| `03-existing-ai.md` | “AI OCR 수출환어음 심사·생성형 AI 기업여신 심사의견” | [하나금융융합기술원 연혁](https://hit.hanati.co.kr/ko/about), [뉴스와이어](https://www.newswire.co.kr/newsRead.php?no=1030500) | ✅확인 | 두 출처가 각각 수출환어음 AI OCR과 기업여신 심사의견 생성·전 영업점 도입을 뒷받침한다. |
| `03-existing-ai.md` | “악성 앱 탐지 AI·AI FDS/보이스피싱 방지 운영” | [하나금융융합기술원 전략자료](https://hit.hanati.co.kr/ko/about/press/view?seq=68), [이데일리](https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=03788406642138744) | ✅확인 | 악성 앱 탐지와 AI 기반 이상거래탐지 운영이 확인된다. 이데일리는 2024년 `9,103건·2,818억원` 예방 수치를 제시한다. |
| `04-candidates.md` 후보 1 | “막히면 송금 전체를 포기하거나 비공식 환전에 의존” | [아시아경제](https://view.asiae.co.kr/article/2026051917460307267) | ⚠️불일치 | 기사는 높은 비용 때문에 **미신고 사설환전** 유인이 생긴다는 이용자 발언은 싣지만, “송금 전체를 포기”한다는 사실은 제시하지 않는다. 수정안: “비용 부담이 미신고 사설환전 유인을 만들 수 있다”로 한정하고, 송금 포기는 사용자 인터뷰로 별도 검증한다. |
| `04-candidates.md` 후보 1 | “기존 Hana EZ는 단순 번역·송금, 차별점은 다국어 안내·예상 완료시간·대체 채널/영업점 연결” | [하나원큐](https://play.google.com/store/apps/details?id=com.hanabank.oqf), [2019 Hana EZ 약관](https://image.kebhana.com/cont/download/documents/provide/0000002019085_20190718.pdf) | ⚠️불일치 | 최신 [Hana EZ 공식 설명](https://play.google.com/store/apps/details?hl=ko&id=com.kebhana.hanasfbank)은 이미 **16개 언어**, 다국어 채팅·전화, 비대면 외국인 계좌개설·고객확인, 수취은행 정보와 도착시간 AI 예측, 송금 진행상황, 지점 검색·모바일번호표·방문예약을 제공한다. 후보를 “인증·송금 실패 원인 진단, 체류자격/목적별 서류 규칙, 실패 후 상태복구”로 훨씬 좁혀야 한다. |
| `04-candidates.md` 후보 1 | “6주 1인 MVP, 4개 언어, 30초 안에 행동 변화” | 외부 출처 없음 | ❓확인불가 | 사실이 아니라 개발·UX 가정이다. 범위 산정표, 언어별 평가셋, 과업완료시간 사용자 테스트가 없으므로 검증할 수 없다. 목표값으로 명시하고 실험 후 수치화해야 한다. |
| `04-candidates.md` 후보 2 | “금융보안원 Challenge가 고령층 디지털 격차를 강조” | [금융보안원 공고](https://www.fsec.or.kr/bbs/detail?bbsNo=11997&menuNo=66) | ✅확인 | 2026-07-13 공고의 예시 주제에 `고령층·장애인의 디지털 격차 해소`가 명시돼 있다. 같은 공고에는 `국내 체류 외국인 금융 정착 AI Agent`도 있어 후보 1 역시 주제 적합성은 높지만, 예시와 가까워 독창성 설명이 더 필요하다. |
| `04-candidates.md` 후보 2 | “기존 AI 연금·자산관리와 달리 이해 확인을 겨냥해 중복을 피한다” | [AI 연금 공식 자료](https://hit.hanati.co.kr/ko/about/press/view?seq=69), [기술 연혁](https://hit.hanati.co.kr/ko/about) | ⚠️불일치 | 비교 대상이 불완전하다. 하나은행은 이미 [교육용 하나원큐 길라잡이](https://play.google.com/store/apps/details?hl=ko&id=com.hanabank.bankingedu)에서 로그인 없이 `배우기·연습하기·평가하기`, 실제 거래·개인정보 없는 모의 뱅킹을 제공한다. 상품설명서 쉬운말 변환·음성·자기말 재진술·직원 연결은 차별점이 될 수 있지만, 일반 모바일뱅킹 연습·퀴즈는 중복이다. |
| `04-candidates.md` 후보 2 | “6주 1인 MVP, 3줄 요약·이해 점수” | 외부 출처 없음 | ❓확인불가 | 설계 가정이다. 고령 사용자 대상 가독성·음성·이해도 평가와 금융소비자보호 검토 없이는 기간과 효과를 확인할 수 없다. |
| `04-candidates.md` 후보 3 | “기존 정책자금 매칭과 달리 운영 의사결정·현금흐름으로 확장” | [하나금융융합기술원 연혁](https://hit.hanati.co.kr/ko/about) | ⚠️불일치 | 정책자금 추천보다 넓다는 방향은 맞지만 기존 서비스 검토가 불완전하다. [하나더소호](https://mbiz.hanabank.com/cont/soho/index.jsp)는 이미 정책자금 사전진단·AI 추천·`오늘 우리가게` 매장분석을 제공하며, [2026 하나 파워 온 스토어](https://mbiz.hanabank.com/cont/soho/event/1526014_156881.jsp)는 `손익을 읽는 AI 경영비서` 교육과 매출·고객·상권 데이터 기반 경영진단·개선방향을 제시하는 AI 컨설팅을 운영한다. `30일 현금잔고·기기별 회수기간·도입 순서의 자동 시뮬레이션`으로 차별 범위를 명시해야 한다. |
| `04-candidates.md` 후보 3 | “30일 예측, 6주 1인 MVP, 2개월 차 마이너스, 30초 데모” | 외부 출처 없음 | ❓확인불가 | 모두 합성 시나리오 또는 개발 목표다. 예측 정확도·현금흐름 산식·기기 효과의 근거가 없으므로 실제 소상공인 효과로 표현하면 안 된다. |

## 3. 치명적 오류

1. **후보 1의 기존 서비스 전제가 현재 상태와 크게 다르다.** 최신 Hana EZ는 이미 16개 언어, 다국어 상담, 여러 인증수단, 비대면 계좌개설·고객확인, 도착시간 예측, 송금 진행상황, 영업점 검색·예약까지 제공한다. 원문의 “기존은 단순 번역·송금이고, 다국어 다음 행동·예상시간·대체 채널이 차별점”이라는 논리로는 중복 심사를 통과하기 어렵다. 후보의 핵심을 **실제 실패코드 진단, 체류자격·송금목적별 서류 판정, 재시도 가능조건, 실패 상태를 이어받는 상담 이관**으로 재정의해야 한다.

후보 2와 3도 각각 `하나원큐 길라잡이`, `하나더소호·하나 파워 온 스토어 AI 컨설팅`을 누락해 차별성 설명을 다시 써야 한다. 다만 상품설명 이해 확인과 30일 현금흐름·기기 ROI 시뮬레이션으로 범위를 좁히면 핵심 문제 자체가 무너지지는 않으므로 치명적 오류로까지 분류하지 않았다.

## 4. 대체 출처

- 하나금융그룹 2025년 실적: [하나금융그룹 2025 Annual Report](https://www.hanafn.com/ir/annualReport.do) — 오표기된 “연합뉴스TV” 대신 사용할 공식 IR 원천.
- 외국인 취업자 수: [대한민국 정책브리핑·통계청 「2024년 이민자체류실태 및 고용조사」](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156666055) — 2024년 5월 `101만명`과 모집단 정의를 직접 확인할 수 있다.
- 은행 점포 감소: [금융위원회 「은행 점포폐쇄 관련 대응방안」 게시 페이지](https://fsc.go.kr/po010101/86201?curPage=5&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) — 동일 기준으로 제시된 `2020년 말 6,427개→2025년 9월 말 5,523개`를 쓰는 것이 안전하다.
- 아시아경제 기사 날짜·외국인 금융 장벽: [원문 페이지](https://view.asiae.co.kr/article/2026051917460307267) — 실제 게시일 `2026-05-21`로 수정.
- Hana EZ 현재 기능: [Hana EZ Google Play 공식 설명](https://play.google.com/store/apps/details?hl=ko&id=com.kebhana.hanasfbank) — 2019년 약관 대신 중복 검토에 사용할 최신 공식 기능 목록.
- 고령층·디지털 금융교육 중복: [교육용 하나원큐 길라잡이 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.hanabank.bankingedu).
- 정책자금 서비스 상세: [하나금융융합기술원 2024-01-15 공식 보도자료](https://hit.hanati.co.kr/m/ko/about/press/view?seq=55).
- 소상공인 기존 플랫폼·컨설팅: [하나더소호](https://mbiz.hanabank.com/cont/soho/index.jsp), [2026 하나 파워 온 스토어 AI 교육·컨설팅](https://mbiz.hanabank.com/cont/soho/event/1526014_156881.jsp).
