# 경쟁·인접 서비스 검증 리포트

> 프로젝트: 골든타임 — AI 사기대응 상황실  
> 조사 기준일: 2026-07-24  
> 조사 범위: 공식 웹사이트·보도자료·앱스토어 공개 정보·스토어 공개 리뷰  
> 내부 기준: [`06-decision.md` §8 기존 서비스 차별화](../research/06-decision.md#8-기존-서비스-차별화-검증된-지도-기준)

## 0. 결론 먼저

골든타임의 방어 가능한 포지션은 “사기 탐지·신고·지급정지를 처음 만든 서비스”가 아니라, 이미 존재하는 공식 수단을 **상황별 순서로 연결하고, 사용자가 끝까지 수행했는지 상태를 관리하며, 다음 채널에 넘길 신고서·증거 묶음을 만드는 허브**다. 이는 내부 결정문의 “판정 근거 설명 → 골든타임 행동 완주 → 산출물” 정의와 일치한다.[기획 근거](../research/06-decision.md#3-솔루션--데스크전면--상황실후면-하나의-부서)

다만 기존 차별화 문구 중 두 곳은 최신 공식 자료에 맞춰 더 정교하게 말해야 한다.

- 카카오뱅크의 스미싱 문자 확인은 붙여넣은 문자에 대해 스미싱 가능성과 **판단 이유·대응 방법**을 제시한다. 따라서 “판정 근거 설명을 하지 않는다”가 아니라, “단일 기능의 판정·권고에서 신고·지급정지·증거 산출까지 상태형으로 이어지지는 않는 것으로 공식 자료에서 확인된다”고 설명해야 한다.[카카오 공식 설명](https://www.kakaocorp.com/page/detail/11361)
- 후스콜의 2026년 글로벌 공식 기능 페이지에는 지역별 제공 기능인 **Scam SOS**가 계좌 동결, 은행 연락, 온라인 신고 바로가기와 단계별 지원을 제공한다고 적혀 있다. 기업용 **API·데이터 피드·SDK**도 공식 제공한다. 따라서 “발신번호 라벨링만 한다”는 주장은 현재 기준으로 안전하지 않다. 한국 제공 여부는 공식 자료에서 확인되지 않았으므로 `△`로 평가하고, 골든타임은 한국 제도 특화 순서·완료 상태·자동 문서·가족 공유·agent용 공개 인터페이스로 차별화해야 한다.[Whoscall 기능](https://web.whoscall.com/en/features) [Whoscall Anti-scam Intelligence](https://web.whoscall.com/en/partners/asi)

### 평가 기호

- `O`: 해당 기능을 공식 자료에서 직접 확인
- `△`: 일부 또는 인접 기능은 확인했으나, 이 보고서가 정의한 범위를 전부 충족하는지는 확인되지 않음
- `X`: 검토한 공식 자료에서 해당 기능을 확인하지 못함. 기능 부재를 단정하는 표시는 아님

“신고 접수”는 경찰의 정식 사건 신고와 민간 앱의 스팸 제보를 구분해 적었다. “지급정지”도 서비스를 통한 실제 신청·처리와 단순 안내·금융사 연동을 구분했다.

---

## 1. 서비스별 프로필

### 1.1 시티즌코난

- **제공 주체·시기·플랫폼:** 현재 앱의 배포·이용계약 주체는 ㈜인피니그루이며 Android 앱이다. 경찰 현장 요청에서 출발한 앱들이 2021년 ‘시티즌코난’으로 통합됐고, 2026년에는 기능과 디자인을 바꾼 신규 앱으로 전환 중이다. 현행 신규 앱의 최초 공개일은 공개 스토어 화면에서 확인되지 않는다.[현행 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [구 앱·신규 앱 전환 안내](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.police.phishingeyes) [2021년 통합 보도](https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=03217686629246704) [이용약관](https://www.citizenkonan.com/rules/terms)
- **경찰청 관계의 정확한 표현:** 경찰이 현재 앱을 직접 운영한다고 단정하기보다, “경찰 현장 요청에서 출발하고 수사기관·금융사 공동대응망을 표방하는 인피니그루 운영 앱”으로 쓰는 편이 공식 스토어와 약관에 부합한다.[현행 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [이용약관](https://www.citizenkonan.com/rules/terms)
- **입력 → 출력:** 사용자가 원탭 검사를 실행하거나 앱이 실시간 감지 → 악성 앱·원격제어 앱·스미싱 위험을 알리고, 탐지 정보를 동의한 제휴 금융사에 전달해 금융거래 사전 차단에 활용한다. 최신 피싱 사례와 주간 안전 리포트도 제공하며, 멤버십 약관에는 피싱피해확인원 발급 신청이 명시돼 있다.[현행 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [공식 홈페이지](https://www.citizenkonan.com/) [이용약관](https://www.citizenkonan.com/rules/terms)
- **커버 범위:** `[탐지/조회] O` `[판정 근거 설명] △` `[행동 안내] △` `[신고 접수] X` `[지급정지] △` `[사후 완주 지원] △`. 앱·문자 위험 유형과 금융사 연동, 멤버십 사후지원은 확인되지만, 대화형 근거 카드·경찰 신고 접수·사용자 주도의 지급정지 완료 추적은 검토한 공식 자료에서 확인되지 않는다.[현행 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [공식 홈페이지](https://www.citizenkonan.com/)
- **스토어 평점(2026-07-24):** 현행 Google Play 공개 페이지에는 별점과 리뷰 수가 표시되지 않았다. 구 앱 페이지도 신규 앱 전환 공지만 노출되고 공개 평점은 확인되지 않았다.[현행 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [구 앱 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.police.phishingeyes)
- **대표 불만 리뷰:** 현행·구 앱의 공개 페이지에서 링크로 검증할 수 있는 리뷰 본문이 노출되지 않아 2~3건을 인용하지 않았다. 외부 재게시 리뷰를 공식 스토어 리뷰로 간주하지 않았다.
- **공식 링크:** [홈페이지](https://www.citizenkonan.com/) · [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) · [이용약관](https://www.citizenkonan.com/rules/terms)

### 1.2 피싱아이즈

- **제공 주체·시기·플랫폼:** ㈜인피니그루가 제공하는 Android·iOS 앱이다. iOS 버전 기록상 1.0은 2021-08-18 공개됐다.[App Store](https://apps.apple.com/kr/app/id1572584458) [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes)
- **입력 → 출력:** 앱이 악성 앱·원격제어 앱·악성 IP/URL·스미싱·가족/지인 사칭 문자를 감지 → 사용자에게 경고하고, 동의한 제휴 금융사에 의심 징후를 전달해 이체·대출 거래 차단에 활용한다. 유료 기능은 등록한 가족·지인의 휴대폰에서 의심 징후가 감지되면 보호자에게 알린다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes) [App Store](https://apps.apple.com/kr/app/id1572584458)
- **커버 범위:** `[탐지/조회] O` `[판정 근거 설명] △` `[행동 안내] △` `[신고 접수] X` `[지급정지] △` `[사후 완주 지원] X`. 위험 종류 알림·가족 알림·제휴 금융사 연동은 확인되지만, 대화형 근거 설명·정식 신고 접수·신고 이후 완료 추적은 검토한 공식 자료에서 확인되지 않는다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes)
- **스토어 평점(2026-07-24):** App Store `1.7/5`, 평가 161개. Google Play 공개 페이지에서는 별점이 노출되지 않았다.[App Store](https://apps.apple.com/kr/app/id1572584458) [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes)
- **대표 불만 리뷰:** 최신순 App Store 공개 피드에서 확인한 예시다. 빈도나 전체 이용자 의견을 뜻하지 않는다.

  - 2026-05-29, 1점: “사용하기 너무 어렵고… 진행이 너무 안됩니다.”
  - 2026-04-28, 1점: “권한설정에서 안 넘어가져요.”
  - 2026-04-15, 2점: “정작 내꺼는 안됨.”

  [App Store 리뷰 피드](https://itunes.apple.com/kr/rss/customerreviews/page=1/id=1572584458/sortby=mostrecent/json)

- **공식 링크:** [홈페이지](https://www.phishingeyes.com/) · [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes) · [App Store](https://apps.apple.com/kr/app/id1572584458)

### 1.3 후스콜

- **제공 주체·시기·플랫폼:** Gogolook이 제공하는 Android·iOS 앱이다. 공식 연혁에는 Android 버전이 2010년, iOS 버전이 2014년 출시된 것으로 적혀 있다.[공식 연혁](https://web.whoscall.com/ko/about)
- **입력 → 출력:** 수신 전화번호, 문자, 사용자가 입력한 전화번호·URL·스크린샷 → 발신자 정보, 스팸/사기 위험, 안전·의심·위험 분류를 표시한다. 사용자 신고는 커뮤니티 데이터에 반영된다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=gogolook.callgogolook2) [공식 기능](https://web.whoscall.com/en/features) [이용약관](https://web.whoscall.com/en/terms)
- **행동·API 중첩:** 글로벌 공식 페이지의 Scam SOS는 계좌 동결·은행 연락·온라인 신고 바로가기와 단계별 안내를 제공한다고 설명하지만 지역별 제공 기능이다. 별도 기업용 상품은 전화번호·도메인 조회 API와 데이터 피드, SDK, OEM/화이트라벨을 제공한다. 한국 소비자 앱에서의 Scam SOS 제공과 agent용 공개 문서·MCP는 공식 자료에서 확인되지 않는다.[공식 기능](https://web.whoscall.com/en/features) [Anti-scam Intelligence](https://web.whoscall.com/en/partners/asi)
- **커버 범위:** `[탐지/조회] O` `[판정 근거 설명] △` `[행동 안내] △` `[신고 접수] △` `[지급정지] △` `[사후 완주 지원] △`. 위험 분류·데이터 출처·민간 신고와 지역별 Scam SOS는 확인되지만, 한국에서의 제공 범위와 공식기관 접수·지급정지의 실제 처리 주체, 완료 상태 추적은 확인되지 않는다.[공식 기능](https://web.whoscall.com/en/features) [이용약관](https://web.whoscall.com/en/terms)
- **스토어 평점(2026-07-24):** Google Play `3.8/5`, 리뷰 약 80.5만 개; App Store `4.8/5`, 평가 약 4만 개. 국가·기기별 공개 집계가 달라질 수 있다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=gogolook.callgogolook2) [App Store](https://apps.apple.com/kr/app/id929968679)
- **대표 불만 리뷰:** 최신순 App Store 공개 피드에서 확인한 예시다.

  - 2026-07-13, 5점: “5 Common이 안 켜져서 사용을 못하고 있어요.”
  - 2026-07-06, 1점: “아이폰은 왜 알림 안 떠요?”
  - 2026-06-25, 1점: “설치 초반에만 뜨고 그 이후로는 안 뜨는데 왜 이러나요?”

  [App Store 리뷰 피드](https://itunes.apple.com/kr/rss/customerreviews/page=1/id=929968679/sortby=mostrecent/json)

- **공식 링크:** [기능](https://web.whoscall.com/en/features) · [Google Play](https://play.google.com/store/apps/details?hl=ko&id=gogolook.callgogolook2) · [App Store](https://apps.apple.com/kr/app/id929968679) · [기업용 API·SDK](https://web.whoscall.com/en/partners/asi)

### 1.4 카카오뱅크 ‘스미싱 문자 확인’

- **제공 주체·시기·플랫폼:** 카카오뱅크가 2024-12-09 출시한 카카오뱅크 앱 내부 기능이다. 별도 웹 판정 도구가 아니라 로그인한 앱에서 이용한다.[카카오뱅크 연혁](https://www.kakaobank.com/view/about/corp/history) [카카오뱅크 AI 소개](https://ai.kakaobank.com/cooperation/pr)
- **입력 → 출력:** 사용자가 의심 문자를 직접 복사해 붙여넣기 → 스미싱 가능성, 판단 이유, 권장 대응 방법을 제시한다. 공식 설명은 개인정보 보호를 위해 문자함 자동 접근 대신 수동 붙여넣기 방식을 택했다고 밝힌다.[카카오 공식 설명](https://www.kakaocorp.com/page/detail/11361)
- **커버 범위:** `[탐지/조회] O` `[판정 근거 설명] O` `[행동 안내] △` `[신고 접수] X` `[지급정지] X` `[사후 완주 지원] X`. 단일 문자 판정·이유·대응 권고는 확인되지만 신고 접수, 지급정지 실행, 이후 단계의 완료 추적은 검토한 공식 기능 설명에서 확인되지 않는다.[카카오 공식 설명](https://www.kakaocorp.com/page/detail/11361)
- **스토어 평점(2026-07-24):** 카카오뱅크 앱 전체 기준 Google Play `3.2/5`, 리뷰 약 6.08만 개; App Store `3.3/5`, 평가 약 1.4만 개다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.kakaobank.channel) [App Store](https://apps.apple.com/kr/app/id1258016944)
- **대표 불만 리뷰:** 아래는 스미싱 문자 확인 기능 전용 리뷰가 아니라 카카오뱅크 앱 전체의 최신 불만 예시다. 기능 결함의 근거로 사용하면 안 된다.

  - 2026-07-18, 1점: “600메가 넘는 건 너무하다고 생각됩니다.”
  - 2026-07-16, 1점: “메모 검색이… 업데이트하고 나서는 결제처만 검색.”
  - 2026-07-14, 3점: “업데이트 뭐야… 거래내역 이미지 왜 이래요.”

  [App Store 리뷰 피드](https://itunes.apple.com/kr/rss/customerreviews/page=1/id=1258016944/sortby=mostrecent/json)

- **공식 링크:** [기능 설명](https://www.kakaocorp.com/page/detail/11361) · [출시 기록](https://www.kakaobank.com/view/about/corp/history) · [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.kakaobank.channel) · [App Store](https://apps.apple.com/kr/app/id1258016944)

### 1.5 보이스피싱 통합신고대응센터 1394

- **제공 주체·연혁·플랫폼:** 경찰청 중심의 범정부 합동 대응 채널이다. 통합신고대응센터는 2023-09-26 개소했고, 2025-09-29에는 보이스피싱 통합수사단이 출범했으며, 대표번호 `1394`는 2026-02-01 운영을 시작했다. 따라서 “2025년 센터 개소”는 정확하지 않다.[금융위원회 2023년 센터 개소](https://www.fsc.go.kr/po010103/80830?curPage=103&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) [경찰청 1394 운영 보도자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1002&q_bbscttSn=20260202072152883) [경찰청 통합수사단 자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1125&q_bbscttSn=20260407161832219)
- **입력 → 출력:** 이용자가 전화로 의심 상황이나 피해 사실을 설명 → 상담, 신고 정보 접수, 관련 전화번호·사이트 정보 수집, 관계기관 연결과 대응 안내를 받는다. 공식 웹 포털도 신고센터·예방 정보·FAQ를 제공한다.[경찰청 1394 운영 보도자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1002&q_bbscttSn=20260202072152883) [통합신고대응센터 포털](https://www.counterscam112.go.kr/)
- **112와의 관계:** 2023년 개소 자료는 기존에 112·1332·금융회사로 나뉘었던 신고·지급정지 창구를 112 신고 한 번으로 사건 접수, 악성 앱 차단, 지급정지까지 연계한다고 설명한다. 1394는 이후 추가된 보이스피싱 전용 상담·신고 대표번호이므로, 긴급 범죄 신고 112를 대체한다고 쓰지 않는다.[금융위원회 2023년 자료](https://www.fsc.go.kr/po010103/80830?curPage=103&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) [센터 포털](https://www.counterscam112.go.kr/)
- **커버 범위:** `[탐지/조회] △` `[판정 근거 설명] △` `[행동 안내] O` `[신고 접수] O` `[지급정지] △` `[사후 완주 지원] △`. 상담·신고·기관 연결은 직접 확인되며, 지급정지는 금융회사·112 등과의 연계이고 사용자가 보는 카운트다운·완료 추적·자동 문서 생성은 공식 자료에서 확인되지 않는다.[금융위원회 2023년 자료](https://www.fsc.go.kr/po010103/80830?curPage=103&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) [센터 포털](https://www.counterscam112.go.kr/)
- **스토어:** 전화·웹 서비스이므로 앱스토어 평점·리뷰 대상이 아니다.
- **공식 링크:** [통합신고대응센터 포털](https://www.counterscam112.go.kr/) · [1394 운영 보도자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1002&q_bbscttSn=20260202072152883)

### 1.6 금융감독원 1332

- **제공 주체·시기·플랫폼:** 금융감독원이 운영하는 금융상담 통합콜센터다. 1332 단일번호는 2002-06-01 시작된 것으로 당시 보도에서 확인되며, 현재도 금융거래 관련 질문·요청·이의신청 상담 번호로 안내된다.[2002년 보도](https://www.hankyung.com/article/2002052794871) [찾기쉬운 생활법령정보](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572)
- **입력 → 출력:** 이용자가 금융거래 질문, 민원, 피해상담 내용을 전화로 설명 → 상담 답변, 문제해결 경로, 피해환급·분쟁조정 안내를 받는다. 금융 민원·분쟁조정은 금융감독원 웹 민원 신청으로 이어질 수 있다.[금융상담·민원처리 설명](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572) [분쟁조정 신청 설명](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=1&cnpClsNo=1&csmSeq=1771)
- **보이스피싱 역할:** 1332는 보이스피싱 등 금융사기 피해상담과 환급 안내 채널이다. 긴급 범죄 신고와 사기이용계좌 지급정지 요청은 112·해당 금융회사 역할과 구분해야 한다.[금융사기 연락처 안내](https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=) [피싱 피해상담·환급 안내](https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=2&cciNo=2&cnpClsNo=2&csmSeq=1650&menuType=cnpcls&popMenu=ov)
- **커버 범위:** `[탐지/조회] X` `[판정 근거 설명] △` `[행동 안내] O` `[신고 접수] △` `[지급정지] △` `[사후 완주 지원] O`. 금융 상담·민원·환급 안내는 확인되지만 경찰 사건 신고나 지급정지를 1332가 직접 완료한다고 보기는 어렵다.[금융상담·민원처리 설명](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572) [금융사기 연락처 안내](https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=)
- **스토어:** 전화·웹 연계 서비스이므로 앱스토어 평점·리뷰 대상이 아니다.
- **공식 링크:** [금융감독원](https://www.fss.or.kr/) · [금융상담·민원 제도 안내](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572)

### 1.7 본인계좌 일괄지급정지

- **제공 주체·시기·플랫폼:** 금융결제원이 운영하는 계좌정보통합관리서비스(어카운트인포)의 기능이다. 온라인 서비스는 2022-12-27 시작했고 모바일은 2023년 1월, 금융회사 영업점·고객센터는 2023년 7월로 확대됐다. 웹, Android·iOS 앱, 금융회사 창구·전화에서 이용할 수 있다.[금융위원회 출시 자료](https://www.fsc.go.kr/no010101/80327?curPage=&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) [금융위원회 모바일 안내](https://fsc.go.kr/po010105/81526?curPage=7&srchBeginDt=&srchCtgry=5&srchEndDt=&srchKey=&srchText=) [공식 서비스 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020)
- **입력 → 출력:** 사용자가 본인 인증 후 지급정지할 본인 명의 계좌를 선택·신청 → 금융결제원이 각 금융회사에 요청을 전달하고 처리 결과를 보여준다. 선택 계좌의 출금 거래가 정지되며 자동이체 등도 포함된다.[공식 서비스 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020)
- **중요한 범위 제한:** 이 기능은 **본인 명의 계좌**의 출금을 일괄 정지하는 수단이다. 이미 사기범 계좌로 송금한 돈을 멈추려면 해당 금융회사나 112를 통해 사기이용계좌 지급정지·피해구제를 별도로 요청해야 한다.[금융위원회 안내](https://fsc.go.kr/no040101?cnId=2195&curPage=&pastPage=&srchKey=&srchText=)
- **커버 범위:** `[탐지/조회] X` `[판정 근거 설명] X` `[행동 안내] △` `[신고 접수] X` `[지급정지] O` `[사후 완주 지원] △`. 지급정지 신청과 처리 결과는 직접 제공하지만, 사기 판정·경찰 신고·전체 피해대응 절차 추적은 공식 기능 범위에서 확인되지 않는다.[공식 서비스 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020)
- **스토어 평점(2026-07-24):** 어카운트인포 앱 전체 기준 Google Play `3.4/5`, 리뷰 약 7.52천 개; App Store `2.9/5`, 평가 약 1.2천 개다.[Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.kftc.payinfo.android) [App Store](https://apps.apple.com/kr/app/id1225117985)
- **대표 불만 리뷰:** 아래는 일괄지급정지 기능 전용 리뷰가 아니라 어카운트인포 앱 전체의 최신 불만 예시다.

  - 2026-07-18, 2점: “업데이트 좀 작작.”
  - 2026-07-14, 1점: “해외에 있는데 ARS 인증 하라네.”
  - 2026-06-24, 1점: “로그인 해도 아무 화면 안 뜸.”

  [App Store 리뷰 피드](https://itunes.apple.com/kr/rss/customerreviews/page=1/id=1225117985/sortby=mostrecent/json)

- **공식 링크:** [본인계좌 일괄지급정지 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020) · [어카운트인포 웹](https://www.payinfo.or.kr/) · [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.kftc.payinfo.android) · [App Store](https://apps.apple.com/kr/app/id1225117985)

### 1.8 금융감독원 ‘보이스피싱 지킴이’

- **제공 주체·시기·플랫폼:** 금융감독원이 2012-11-20 개설한 웹 전용 포털이다. 개설 당시 보이스피싱 개요, 피해예방, 피해금 환급, 주요제도 안내 등 4개 메뉴·32개 콘텐츠로 구성됐다.[개설 자료 아카이브](https://epts.kdi.re.kr/archive/frwdHist/view2?EPIC_NUM=165656)
- **확장 연혁:** 2015-07-13 경찰청·금융감독원이 체험관과 ‘그놈 목소리’ 신고·공개를 공동 운영했고, 2020년에는 별도 온라인 예방 체험관에서 사기 음성·대처 사례·퀴즈·예방 앱/기술을 소개했다.[행정안전부 협업 사례](https://www.mois.go.kr/frt/bbs/type002/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000216&nttId=49204) [금융위원회 2020 체험관 자료](https://www.fsc.go.kr/no010101/74345?curPage=198&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=)
- **입력 → 출력:** 사용자가 피해 유형·예방·피해환급·주요제도 콘텐츠와 실제 사기 음성을 탐색하거나 음성을 제보 → 예방·대처·환급 절차 정보를 얻고 관련 신고 채널로 이동한다. 사용자의 문자나 통화 상황을 입력받아 개별 판정하는 도구로는 공식 개설 자료에서 설명되지 않는다.[개설 자료 아카이브](https://epts.kdi.re.kr/archive/frwdHist/view2?EPIC_NUM=165656) [행정안전부 협업 사례](https://www.mois.go.kr/frt/bbs/type002/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000216&nttId=49204)
- **커버 범위:** `[탐지/조회] △` `[판정 근거 설명] X` `[행동 안내] O` `[신고 접수] △` `[지급정지] △` `[사후 완주 지원] O`. 사례·제도·환급 절차와 제보/신고 연결은 확인되지만 개인 상황 판정, 지급정지 직접 처리, 행동 완료 상태 관리는 공식 자료에서 확인되지 않는다.[개설 자료 아카이브](https://epts.kdi.re.kr/archive/frwdHist/view2?EPIC_NUM=165656)
- **접근성 확인:** 공식 포털 주소는 계속 공공기관 안내에 인용되고 있으나, 이번 자동화 조사에서는 HTTPS 응답을 안정적으로 불러오지 못했다. 따라서 현재 내부 화면과 링크 정상 작동 여부는 실기기·일반 브라우저에서 별도 확인이 필요하다.[공식 포털](https://phishing-keeper.fss.or.kr/) [공공기관 안내](https://www.incheon.go.kr/eco/ECO050201/1952642)
- **스토어:** 웹 서비스이므로 앱스토어 평점·리뷰 대상이 아니다.
- **공식 링크:** [보이스피싱 지킴이](https://phishing-keeper.fss.or.kr/) · [개설 자료](https://epts.kdi.re.kr/archive/frwdHist/view2?EPIC_NUM=165656)

### 1.9 경찰청 사이버범죄 신고시스템(ECRM)

- **제공 주체·시기·플랫폼:** 경찰청의 웹·모바일 웹 신고 시스템이다. 전신은 2004년 구축됐고 2017년 모바일 서비스를 시작했으며, 현행 ECRM은 2020-12-23 전면개편 대민 서비스를 시작했다.[구축·개편 연혁 보도](https://www.koit.co.kr/news/articleView.html?idxno=105235) [2020년 개편 보도](https://www.sidae.com/article/2020122220088061089) [ECRM 공식 사이트](https://ecrm.police.go.kr/minwon/main)
- **입력 → 출력:** 피해자가 범죄 유형을 고르고 육하원칙에 따라 피해 내용을 작성하며 신분증·이체내역·메신저 대화 등 증빙을 첨부 → 온라인 임시 접수와 사건 처리 절차 안내를 받는다. 상담·제보와 신고 조회도 제공한다.[ECRM 메인·작성 안내](https://ecrm.police.go.kr/minwon/main) [사건처리 절차](https://ecrm.police.go.kr/minwon/crs/quick/process)
- **방문·대리 신고 제한:** 원칙적으로 온라인 접수 후 경찰서 방문·진술이 필요하며, 다중피해 사이버사기 중 조건을 충족한 경우에는 출석 없이 수사가 진행될 수 있다. 신고는 직접 피해자만 가능하고 가족 등 대리인은 경찰서 방문 또는 국민신문고를 이용해야 한다.[ECRM 메인·안내](https://ecrm.police.go.kr/minwon/main) [사건처리 절차](https://ecrm.police.go.kr/minwon/crs/quick/process)
- **지급정지 관계:** ECRM은 피싱·파밍·스미싱 등을 지급정지 가능한 사이버금융범죄로 설명하지만, 사이트 자체가 금융회사 계좌의 지급정지를 실행한다고 설명하지는 않는다.[사이버범죄 분류](https://ecrm.police.go.kr/minwon/crs/quick/cyber1)
- **커버 범위:** `[탐지/조회] △` `[판정 근거 설명] X` `[행동 안내] O` `[신고 접수] O` `[지급정지] △` `[사후 완주 지원] O`. 범죄유형 안내·온라인 서류 작성·증거 첨부·신고 조회·피해자 구제 안내는 확인되지만, 입력한 상황의 사기 판정과 지급정지 실행은 공식 자료에서 확인되지 않는다.[ECRM 공식 사이트](https://ecrm.police.go.kr/minwon/main) [피해자 구제 제도](https://ecrm.police.go.kr/minwon/crs/quick/vichelp)
- **스토어:** 웹·모바일 웹 서비스이므로 앱스토어 평점·리뷰 대상이 아니다.
- **공식 링크:** [ECRM](https://ecrm.police.go.kr/minwon/main) · [사건처리 절차](https://ecrm.police.go.kr/minwon/crs/quick/process) · [사이버범죄 분류](https://ecrm.police.go.kr/minwon/crs/quick/cyber1)

---

## 2. 기능 대비표

### 열의 엄격한 정의

- **대화형 판정·근거 설명:** 자유로운 문자·통화·상황 입력을 문맥적으로 판정하고 근거를 설명하는 흐름. 고정 전화번호 조회나 상담만 있으면 `△`.
- **골든타임 행동 오케스트레이션:** 피해 상태에 따라 행동 순서를 정하고, 다음 단계 호출과 완료 상태까지 관리하는 기능. 단순 권고·링크·자동 차단만 있으면 `△`.
- **신고서·증거 산출물 생성:** 사용자의 입력에서 제출 가능한 신고서·타임라인·증거 묶음을 자동 생성. 서식 입력·첨부·처리결과만 지원하면 `△`.
- **가족 공유:** 특정 사건의 판정·행동·요약을 가족에게 공유하거나 보호자가 추적. 가족 요금제나 위험 알림만 있으면 `△`.
- **agent API·MCP:** 다른 AI 에이전트가 사기 판정을 호출할 수 있는 공개·문서화 인터페이스. 기업용 일반 API만 있으면 `△`.
- **무설치 웹 접근:** 핵심 소비자 기능을 앱 설치 없이 웹에서 사용.

| 서비스 | 대화형 판정·근거 설명 | 골든타임 행동 오케스트레이션 | 신고서·증거 산출물 생성 | 가족 공유 | agent API·MCP | 무설치 웹 접근 |
|---|---:|---:|---:|---:|---:|---:|
| 시티즌코난 | X[^cmp-ck] | △[^cmp-ck] | △[^cmp-ck] | X[^cmp-ck] | X[^cmp-ck] | X[^cmp-ck] |
| 피싱아이즈 | X[^cmp-pe] | △[^cmp-pe] | X[^cmp-pe] | △[^cmp-pe] | X[^cmp-pe] | X[^cmp-pe] |
| 후스콜 | △[^cmp-wc] | △[^cmp-wc] | X[^cmp-wc] | X[^cmp-wc] | △[^cmp-wc] | X[^cmp-wc] |
| 카카오뱅크 스미싱 문자 확인 | △[^cmp-kb] | △[^cmp-kb] | X[^cmp-kb] | X[^cmp-kb] | X[^cmp-kb] | X[^cmp-kb] |
| 통합신고대응센터 1394 | △[^cmp-1394] | △[^cmp-1394] | X[^cmp-1394] | X[^cmp-1394] | X[^cmp-1394] | O[^cmp-1394] |
| 금융감독원 1332 | △[^cmp-1332] | △[^cmp-1332] | X[^cmp-1332] | X[^cmp-1332] | X[^cmp-1332] | △[^cmp-1332] |
| 본인계좌 일괄지급정지 | X[^cmp-ai] | X[^cmp-ai] | X[^cmp-ai] | X[^cmp-ai] | X[^cmp-ai] | O[^cmp-ai] |
| 보이스피싱 지킴이 | X[^cmp-vp] | △[^cmp-vp] | X[^cmp-vp] | X[^cmp-vp] | X[^cmp-vp] | O[^cmp-vp] |
| 경찰청 ECRM | △[^cmp-ecrm] | △[^cmp-ecrm] | △[^cmp-ecrm] | X[^cmp-ecrm] | X[^cmp-ecrm] | O[^cmp-ecrm] |
| **골든타임(기획 기준)** | **O**[^cmp-gt] | **O**[^cmp-gt] | **O**[^cmp-gt] | **O**[^cmp-gt] | **O**[^cmp-gt] | **O**[^cmp-gt] |

[^cmp-ck]: 현행 공식 자료는 악성 앱·스미싱 탐지, 제휴 금융사 사전 차단, 주간 리포트와 멤버십의 피싱피해확인원 발급 신청을 설명한다. 대화형 판정, 사건 가족 공유, agent API/MCP, 웹 핵심 기능은 확인되지 않는다. [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [공식 홈페이지](https://www.citizenkonan.com/) [이용약관](https://www.citizenkonan.com/rules/terms)
[^cmp-pe]: 공식 스토어는 악성 앱·문자 탐지, 제휴 금융사 연동, 등록 가족·지인의 위험 알림을 설명한다. 이는 사건 리포트 가족 공유나 순차 행동·자동 신고문서와는 범위가 다르며, 공개 API/MCP와 웹 핵심 기능은 확인되지 않는다. [Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes)
[^cmp-wc]: 번호·URL·스크린샷 위험 분류는 확인되지만 대화형 흐름은 확인되지 않는다. Scam SOS는 단계별 행동을 제공하나 지역별 기능이고 한국 제공 여부가 확인되지 않는다. 기업용 API·데이터 피드는 존재하지만 agent용 공개 MCP는 확인되지 않는다. 사건 문서 자동 생성·사건 가족 공유·웹 소비자 판정은 확인되지 않는다. [기능](https://web.whoscall.com/en/features) [기업용 API·SDK](https://web.whoscall.com/en/partners/asi)
[^cmp-kb]: 공식 자료는 수동 붙여넣기 후 스미싱 가능성·판단 이유·대응 방법을 제공한다고 설명한다. 다중 턴 대화, 순차 완료 추적, 자동 문서, 가족 공유, 공개 API/MCP, 웹판은 확인되지 않는다. [기능 설명](https://www.kakaocorp.com/page/detail/11361)
[^cmp-1394]: 1394·센터는 전화 상담·신고와 기관 연계를 제공하고 웹 포털이 있다. 사용자가 보는 근거 카드·카운트다운 완료 추적·자동 문서·가족 공유·공개 API/MCP는 검토한 공식 자료에서 확인되지 않는다. [경찰청 1394 자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1002&q_bbscttSn=20260202072152883) [센터 포털](https://www.counterscam112.go.kr/)
[^cmp-1332]: 전화 상담은 대화형이고 행동·환급 절차를 안내하며, 별도 금융감독원 웹 민원 채널로 연결될 수 있어 `△`다. 자동 신고문서·사건 가족 공유·공개 API/MCP는 확인되지 않는다. [금융상담·민원 제도](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=1&csmSeq=572) [분쟁조정 신청](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=1&cnpClsNo=1&csmSeq=1771)
[^cmp-ai]: 공식 서비스는 본인 계좌 선택, 일괄지급정지 신청, 금융회사 전달, 처리 결과 표시를 제공한다. 비교표의 다른 다섯 기능은 이 공식 기능 설명에서 확인되지 않는다. [공식 서비스 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020)
[^cmp-vp]: 공식 개설 자료는 피해예방·피해금 환급·제도·사례 콘텐츠와 신고 연결을 설명한다. 개인 상황 판정, 완료 추적, 자동 문서, 가족 공유, 공개 API/MCP는 확인되지 않는다. [개설 자료](https://epts.kdi.re.kr/archive/frwdHist/view2?EPIC_NUM=165656) [협업 체험관](https://www.mois.go.kr/frt/bbs/type002/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000216&nttId=49204)
[^cmp-ecrm]: ECRM의 폴봇·온라인 서류 작성은 대화형 접수 보조에 가깝고 사기 판정·근거 설명은 확인되지 않아 `△`다. 서류 작성·증거 첨부는 지원하지만 사용자 입력에서 신고서·증거 패키지를 자동 생성하지 않아 `△`다. 직접 피해자만 신고할 수 있어 가족 공유는 `X`이며, 공개 API/MCP는 확인되지 않는다. 웹 신고는 `O`다. [ECRM 메인](https://ecrm.police.go.kr/minwon/main) [사건처리 절차](https://ecrm.police.go.kr/minwon/crs/quick/process)
[^cmp-gt]: 아직 구현 검증이 아니라 확정 기획 범위를 표시한 행이다. 내부 결정문은 상황 입력→근거 카드, 카운트다운 행동 카드, 신고서·타임라인·증거 PDF·가족 요약, 공개 API·MCP, 무로그인 웹을 명시한다. [솔루션 정의](../research/06-decision.md#3-솔루션--데스크전면--상황실후면-하나의-부서) [Agent-friendly 레이어](../research/06-decision.md#agent-friendly-레이어-uniqueness의-쐐기) [심사 데모](../research/06-decision.md#5-심사-데모-시나리오-2분-풀코스-30초-안에-1차-감탄)

### 표에서 읽어야 할 실제 공백

공식 자료 기준으로 가장 방어하기 쉬운 공백은 “어떤 기능도 행동을 안내하지 않는다”가 아니다. 여러 서비스가 이미 경고·대응 안내·기관 연결·서류 작성을 일부 제공한다. 골든타임이 증명해야 할 것은 다음 세 가지의 결합이다.

1. **상황별 상태 머신:** 아직 송금 전, 송금 직후, 악성 앱 설치 의심, 개인정보만 노출, 가족 대리 확인 등 상태마다 첫 행동과 순서를 바꾸고 완료 여부를 저장한다.
2. **채널 간 핸드오프:** 전화번호나 링크만 던지는 것이 아니라, 다음 채널에 말할 문구·필요 정보·완료 확인 질문을 함께 제공한다.
3. **한 번 입력한 사실의 재사용:** 같은 사건 정보를 은행 지급정지 요청 문구, 112·1394 상담 스크립트, ECRM 진술서, 증거 목록, 가족 공유 요약으로 재구성한다.

이 세 항목은 골든타임 내부 기획에 명시돼 있지만 아직 구현 성과가 아니므로, 제출물에서는 동작 URL과 다운로드 산출물로 증명해야 한다.[내부 데모 기준](../research/06-decision.md#5-심사-데모-시나리오-2분-풀코스-30초-안에-1차-감탄)

---

## 3. ‘허브’ 연결 지점 제안

### 3.1 호출 원칙

- **이미 돈이 나갔다면 탐지 앱 설치·재검사보다 지급정지·신고를 먼저 노출한다.** 금융당국 안내는 송금 피해 시 금융회사나 112를 통한 신속한 지급정지를 우선한다.[금융사기 연락처 안내](https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=)
- **본인계좌 일괄지급정지와 사기이용계좌 지급정지를 섞지 않는다.** 전자는 본인 명의 계좌의 출금을 막는 수단이고, 이미 송금한 상대 계좌는 금융회사·112에 별도로 요청해야 한다.[금융위원회 안내](https://fsc.go.kr/no040101?cnId=2195&curPage=&pastPage=&srchKey=&srchText=)
- **앱 설치가 필요한 서비스는 긴급 단계가 끝난 뒤 또는 송금 전 예방 단계에서 제안한다.** 설치·권한·본인인증 지연이 지급정지 골든타임을 침범하지 않게 한다.
- **외부 서비스의 완료를 골든타임이 대신 주장하지 않는다.** “전화 연결”, “요청함”, “접수번호 입력”, “처리 결과 확인”을 별도 상태로 두고 사용자가 확인한 사실만 저장한다.

### 3.2 서비스별 행동 카드

| 연결 대상 | 언제 노출할지 | 골든타임 행동 카드 제안 | 오인 방지 문구·완료 기준 |
|---|---|---|---|
| 시티즌코난 | Android에서 악성 앱·원격제어 앱 설치가 의심되고, 송금 전이거나 긴급 지급정지 이후 | `시티즌코난에서 악성 앱 검사` → 공식 앱 열기/설치 → 검사 결과를 사건 타임라인에 사용자가 기록 | “경찰 신고·지급정지 접수가 아닙니다.” 완료는 사용자가 검사 결과를 확인했을 때. [공식 앱](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) |
| 피싱아이즈 | 지속 예방이 필요하거나 가족·지인 보호 알림을 설정하려는 단계 | `피싱아이즈로 실시간 탐지·가족 보호 설정` → 공식 앱 열기 → 권한·보호대상 등록 안내 | “유료 가족 알림과 금융사 연동 범위는 앱 조건을 확인하세요.” 긴급 송금 피해 시 먼저 금융회사·112. [공식 앱](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes) |
| 후스콜 | 송금 전 번호·URL·스크린샷을 교차 확인하거나 수신 단계에서 차단하려는 경우 | `후스콜에서 번호/URL/스크린샷 재확인` → 앱의 Check 기능으로 이동. 한국 앱에서 Scam SOS가 실제 노출되는 경우에만 해당 바로가기를 보조 카드로 제시 | “조회 결과는 참고 정보이며 공식기관 확인을 대체하지 않습니다. Scam SOS는 지역별 제공입니다.” [기능](https://web.whoscall.com/en/features) |
| 카카오뱅크 스미싱 문자 확인 | 카카오뱅크 이용자가 아직 링크를 누르거나 송금하지 않았고 문자 2차 판정이 필요한 경우 | `카카오뱅크 앱에서 스미싱 문자 확인` → 의심 문자 복사 → 앱 기능에 붙여넣기 → 결과를 골든타임 사건에 메모 | “카카오뱅크 앱 내부 기능이며 자동 신고·지급정지는 아닙니다.” [공식 설명](https://www.kakaocorp.com/page/detail/11361) |
| 1394 통합신고대응센터 | 보이스피싱 의심·피해 상담과 관계기관 연결이 필요한 경우. 긴급 범죄는 112도 병기 | `1394에 전화` → 골든타임이 사건 요약·질문 스크립트 표시 → 통화 후 안내받은 기관·접수 정보 기록 | “긴급 범죄 신고는 112, 금융회사 지급정지 요청은 지체하지 마세요.” 완료는 통화 연결이 아니라 상담 내용·다음 조치를 기록했을 때. [센터 포털](https://www.counterscam112.go.kr/) |
| 금융감독원 1332 | 지급정지·경찰 신고 후 피해환급, 금융회사 처리, 금융민원·분쟁 상담이 필요한 경우 | `1332 피해상담` → 피해금·금융회사·지급정지 여부를 정리한 통화 스크립트 → 환급/민원 다음 단계 기록 | “경찰 사건 신고 번호가 아니라 금융상담 번호입니다.” [상담·환급 안내](https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=2&cciNo=2&cnpClsNo=2&csmSeq=1650&menuType=cnpcls&popMenu=ov) |
| 본인계좌 일괄지급정지 | 개인정보·인증수단·원격제어 노출로 **본인 명의 여러 계좌의 추가 출금**이 우려되는 경우 | `내 계좌 전체 출금 막기` → 어카운트인포 웹/앱 또는 금융회사 전화 선택 → 대상 계좌 선택 → 처리 결과를 하나씩 체크 | “이미 돈을 받은 사기범 계좌를 정지하는 기능이 아닙니다.” 완료는 각 금융회사의 처리 결과를 확인했을 때. [공식 안내](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020) |
| 보이스피싱 지킴이 | 예방교육, 유사 사례·사기 음성 확인, 지급정지 후 피해환급·제도 학습 단계 | `금감원 사례·피해구제 절차 보기` → 관련 유형·환급 안내로 연결 | “긴급 실행 채널이 아닌 정보 포털입니다.” 링크 가용성은 배포 전 실브라우저 재검증. [공식 포털](https://phishing-keeper.fss.or.kr/) |
| 경찰청 ECRM | 긴급 지급정지와 112·1394 상담 후, 온라인 신고 서류와 증거를 정리할 단계 | `ECRM 신고 준비` → 골든타임 사건 타임라인을 육하원칙 필드로 변환 → 증거 파일 목록·해시/생성시각 정리 → ECRM 열기 → 임시접수번호를 골든타임에 기록 | “대부분 온라인 접수 후 경찰서 방문이 필요하며, 직접 피해자만 온라인 신고할 수 있습니다.” [ECRM 안내](https://ecrm.police.go.kr/minwon/main) |

### 3.3 권장 시간축

"보존할 상태"는 **사용자 브라우저 세션 내 유지**를 뜻한다 — 서버에는 원문·실번호·활성 URL을
저장하지 않는다는 상위 원칙(10·11 문서)이 우선한다.

| 사건 상태 | 1순위 | 이어서 | 골든타임이 보존할 상태(기기 내 세션) |
|---|---|---|---|
| 송금 전·문자만 수신 | 골든타임 근거 판정 | 카카오뱅크/후스콜 교차 확인, 필요 시 시티즌코난·피싱아이즈 검사 | 원문, URL, 발신번호, 판정 근거. [카카오뱅크](https://www.kakaocorp.com/page/detail/11361) [후스콜](https://web.whoscall.com/en/features) |
| 이미 송금 | 해당 금융회사·112를 통한 지급정지 | 1394 상담·신고, 추가 계좌 노출 시 본인계좌 일괄지급정지 | 통화시각, 금융회사, 요청 결과, 접수번호. [금융사기 연락처](https://www.easylaw.go.kr/CSP/CnpClsMainPreview.laf?ccfNo=3&cciNo=2&cnpClsNo=1&csmSeq=2853&popMenu=ov&search_put=) [어카운트인포](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020) |
| 악성 앱·원격제어 의심 | 통화 제어 가능성을 고려해 가능하면 안전한 별도 기기로 금융회사·112 연락 | 긴급 조치 후 시티즌코난/피싱아이즈 검사, 인증수단 폐기·재발급 안내 | 감염 의심 기기, 설치 앱, 조치 결과. 금융위원회는 악성 앱이 전화 수·발신을 제어할 수 있으며, 피해 시 금융회사·112에 지체 없이 지급정지를 요청하라고 안내한다. [금융위원회 안내](https://www.fsc.go.kr/po010101/85338?curPage=31&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=) |
| 지급정지 후 | 증거 보존·사건 타임라인 확정 | ECRM 온라인 작성, 1332 피해환급·금융민원 상담 | 증거 목록, ECRM 임시접수번호, 방문 일정. [ECRM](https://ecrm.police.go.kr/minwon/main) [1332](https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=2&cciNo=2&cnpClsNo=2&csmSeq=1650&menuType=cnpcls&popMenu=ov) |
| 가족에게 알릴 필요 | 가족 공유용 최소정보 1페이지 생성 | 피싱아이즈 보호 알림 등 예방 설정 제안 | 공유 대상·시각·동의, 민감정보 마스킹 여부. [피싱아이즈](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.lite.phishingeyes) |

ECRM은 신분증·이체내역·메신저 대화 등 증빙 첨부와 육하원칙 진술을 요구하므로, 골든타임의 자동 산출물은 독자적인 신고 채널이 아니라 **ECRM 입력 비용을 줄이는 전처리·핸드오프**로 설명하는 것이 정확하다.[ECRM 작성 안내](https://ecrm.police.go.kr/minwon/main)

---

## 4. 심사 대응용 문장

### 사용해도 방어 가능한 문장

> 시티즌코난·피싱아이즈는 악성 앱과 스미싱 징후 탐지·금융사 연동에 강하고, 카카오뱅크와 후스콜은 메시지·번호·URL 등의 위험 판단을 제공한다. 112·1394·ECRM은 공식 신고 경로이고, 금융회사·어카운트인포는 지급정지 실행 수단이며, 1332·보이스피싱 지킴이는 상담·피해구제 정보를 제공한다. 골든타임은 이 수단들을 대체하지 않고, 피해 상태에 맞는 순서와 전달 문구를 만들고 완료 상태를 추적하며, 다음 채널에 넘길 신고서·증거 묶음을 생성하는 허브다.

이 문장은 각 서비스의 확인된 강점을 먼저 인정하면서 골든타임의 연결 역할을 설명한다.[시티즌코난](https://play.google.com/store/apps/details?hl=ko&id=com.infinigru.phishingeyes.premium) [카카오뱅크](https://www.kakaocorp.com/page/detail/11361) [후스콜](https://web.whoscall.com/en/features) [통합센터](https://www.counterscam112.go.kr/) [어카운트인포](https://www.payinfo.or.kr/guide/introPayStop.do?menu=19&t=123020) [ECRM](https://ecrm.police.go.kr/minwon/main)

### 피해야 할 설명 방식

- 기존 서비스의 역할을 탐지로만 축소하기 → 카카오뱅크는 대응 방법을 제시하고, 후스콜은 지역별 Scam SOS, 1394·1332·ECRM·보이스피싱 지킴이는 안내·신고·구제 절차를 제공한다.
- 후스콜을 발신번호 조회 기능으로만 소개하기 → 현재 공식 자료는 URL·스크린샷 판정, Scam SOS, 기업용 API·SDK까지 설명한다.
- 1394 센터의 개소 연도를 2025년으로 적기 → 센터 2023년 개소, 합동수사단 2025년 출범, 1394 번호 2026년 운영 개시로 구분해야 한다.
- 어카운트인포가 사기범 계좌를 직접 정지한다고 설명하기 → 본인 명의 계좌 일괄지급정지와 사기이용계좌 지급정지는 별개다.
- ECRM이 사용자 원문에서 신고서를 자동 생성한다고 설명하기 → 온라인 서류 작성·예시·증거 첨부는 지원하지만, 신고서·증거 패키지 자동 생성은 공식 자료에서 확인되지 않는다.

---

## 5. 한계와 후속 실기기 검증

이 리포트는 2026-07-24 기준 공식 자료, 공개 스토어 화면, Apple의 공개 리뷰 피드를 사용한 **데스크 리서치**다. 앱 내부의 실제 화면 전환, 로그인 조건, 지역·기기별 기능, 딥링크 동작, 접근성, 전화 연결 후 상담 흐름은 실기기 사용 캡처로 검증하지 않았다. 따라서 앱 내부 상세 UX는 모두 “공식 자료 기준”으로 이해해야 한다.

평점과 리뷰 수는 국가·기기·시점에 따라 변한다. 인용 리뷰는 최신순 공개 피드에서 사용상 불만이 드러나는 2~3건을 예시로 고른 것이며, 불만의 빈도나 전체 이용자 만족도를 대표한다는 뜻이 아니다. 카카오뱅크·어카운트인포 리뷰는 해당 사기대응 기능이 아니라 앱 전체 리뷰다.

Google Play 공개 페이지에 평점·리뷰가 노출되지 않은 시티즌코난과 피싱아이즈 Android 버전은 수치를 추정하지 않았다. 시티즌코난은 링크로 검증할 수 있는 공개 리뷰 본문도 확인되지 않아 인용을 생략했다.

`X`는 부재를 단정하는 기호가 아니라 **이번에 검토한 공식 자료에서 확인되지 않음**을 뜻한다. 특히 기관 내부 연계 API, 금융회사 전용망, 상담원 내부 시스템은 소비자용 공개 페이지에 나타나지 않을 수 있다.

배포 전 실기기 검증 체크리스트:

- 시티즌코난 신규 앱의 최초 공개일, 실제 평점·리뷰, 검사 결과 화면과 피싱피해확인원 흐름
- 피싱아이즈의 가족 보호 등록·알림 범위와 금융사 연동 시 사용자 화면
- 후스콜 한국 계정에서 Scam SOS 제공 여부, 국내 은행·신고 링크, API 신청·문서 공개 범위
- 카카오뱅크 스미싱 문자 확인의 로그인 조건, 결과 근거와 행동 링크, 공유·저장 가능 여부
- 1394 상담 후 접수번호·기관 이관·지급정지 연결의 실제 안내 흐름
- 어카운트인포 웹·앱의 일괄지급정지 인증 단계와 처리 결과 화면
- 보이스피싱 지킴이 공식 포털의 현재 접속·내부 링크 상태
- ECRM에서 골든타임 산출물의 필드 매핑, 파일 형식·용량, 임시접수번호와 방문 안내
