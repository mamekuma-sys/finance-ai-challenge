# 개정 계약 r5 적용 보고서

- 적용일: 2026-07-25
- 지시 계약: `docs/planning/21-revision-plan-r5.md`
- 검증 근거: `app/docs/evidence-verified.md`
- 내용 수정 범위: `docs/planning/11-spec-draft.md`,
  `docs/planning/10-proposal-draft.md`, `docs/planning/01-golden-time-sources.md`
- 이 파일은 완료 기준에서 별도로 요구한 적용·검증 보고서다.

## H1~H6 변경 위치

### H1 — 법정 서면 제출 기한과 적용 대상

- `docs/planning/11-spec-draft.md`: §2.2 F-07, §3.3 데모 설명·표, §4.5.3 R3,
  §4.5.4 스냅샷 a·b·d, §4.7, §6.2, §9.10
- `docs/planning/10-proposal-draft.md`: §2 요약·와우 장면, §3.3, §4.1, §4.5, §5.4
- `docs/planning/01-golden-time-sources.md`: ③ 지급정지의 법적 절차
- `TPL-WRITTEN-FOLLOWUP-001`의 버전을 R3, 스냅샷 a·b·d, §4.7에서 `@1.1`로
  올렸다. 템플릿 ID, `procedure:written_followup`, §4.5.1 ④ 전역 승격 규칙은 바꾸지
  않았다.

### H2 — 채권소멸 뒤 결정 기한

- `docs/planning/01-golden-time-sources.md`: ③에서 금융감독원이 채권 소멸일부터 정해진
  기간 안에 피해환급금을 받을 사람과 금액을 결정한다는 승인 의미로 고쳤고, 환급 완료
  기한이 아님을 명시했다.
- 기능명세서와 기획서에는 H2의 금지 표현이 없음을 검색으로 확인했다.

### H3 — 원문 미확인 설문 수치

- `docs/planning/10-proposal-draft.md`: §3.2 사용자 인지 행을 `사용자 인지 근거 미확보`로
  교체하고 원문 URL 재검증 전 정량 근거 사용 금지를 명시했다. 같은 절에서 F-10의 근거를
  연령별 피해 통계가 아닌 NF-04·NF-05 접근성 요구 충족으로 한정했다.
- `docs/planning/01-golden-time-sources.md`: ②를 `❌ 원문 미확인 — UI·문서 사용 금지`
  판정 이력으로 갱신했다. 원문 게시 URL 미확보와 재게시 보도자료에도 `161명`이 없다는
  사실을 같은 ❌ 문단에 기록하고, 기존 확정 인용문에서 설문 수치를 제거했다.
- `docs/planning/11-spec-draft.md`: 금지 수치가 없음을 검색으로 확인했다.

### H4 — 기준 연도·정의가 없는 시장 규모 수치

- `docs/planning/10-proposal-draft.md`: §3.2 시장 규모 행을 `시장 규모 근거 미확보`로
  바꾸고, 공식 페이지 표지에 기준 연도·잠정 여부·집계 정의가 없어 통계 카드에 사용하지
  않는다고 명시했다.
- 같은 표의 E5 행은 실접속 검증에서 승인된 기간·전년 동기·감소 수치를 함께 쓰고,
  신종 스캠의 풍선효과를 후속 과제로 설명하도록 유지·정확화했다.

### H5 — 지연인출제도

- `docs/planning/10-proposal-draft.md`: §3.3에 승인 문자열과 창구 거래 즉시 가능,
  개별 사건의 잔여 시간·회수 가능성이 아니라는 조건을 함께 기재했다.
- `docs/planning/01-golden-time-sources.md`: ① 판정과 `기획서 인용 문장 (확정)`을 같은
  승인 문자열·필수 병기 조건으로 갱신하고, 확인되지 않은 시행일을 제거했다.

### H6 — 118과 기관 역할

- `docs/planning/11-spec-draft.md`: §4.5.3 R1·R2의 기존 행동 안에 KISA 상담센터 118
  후속 안내를 추가했다. 새 카드나 `merge_key`는 만들지 않았다.
- `docs/planning/11-spec-draft.md`: §4.5.3 R3과 기관 역할 문단에서 1394를
  피해상담·의심 전화번호/사이트 제보·관계기관 연계로, 1332를 금융감독원의 금융상담과
  피해상담·접수·구제 안내로 구분했다. R5·R7에는 보이스피싱 관련 1332 공식 출처를
  병기했다.
- `docs/planning/10-proposal-draft.md`: §4.4 비교표와 바로 아래 역할 설명을 같은 기관
  명칭·권한 경계로 맞췄다.

## 판단이 필요했던 지점과 근거

1. `3개 파일만 수정` 지시와 이 적용 보고서 작성 요구가 함께 있었다. 내용 변경은 지정된
   세 문서에만 적용하고, 더 구체적인 완료 기준에 명시된 이 보고서만 예외 산출물로
   작성했다.
2. 출처 문서 ②는 판정 이력을 남기라는 지시 때문에 삭제하지 않았다. 금지 수치 가운데
   재게시본에도 없다는 사실을 명시하도록 지시된 `161명`만 ❌ 판정 문단 안에 남겼고,
   승인 수치·인용문은 모두 제거했다.
3. R1·R2의 118 안내는 r5가 허용한 `required_followup` 범위로 보았다. 카드 수,
   `merge_key`, 정렬·병합 구조를 바꾸지 않고 기존 행동 서술에 승인 문자열을 붙였다.
4. H4는 검증되지 않은 시장 규모를 다른 시장 규모 숫자로 대체하지 않았다. 근거 미확보를
   명시하고, 별도 `현재 변화` 행에만 검증 통과한 E5 문자열을 사용했다.
5. H2의 문제 표현은 출처 문서에만 있었다. 승인된 결정 기한 문장으로 고쳐 세 문서의
   의미를 일치시켰다.

## grep 검증 결과 원문

아래 검사는 저장소 루트에서 실행했다. 첫 세 명령은 매치가 없어 출력이 없었고 종료 코드는
각각 `1`이었다. `grep`에서 이는 오류가 아니라 검색 결과 0건을 뜻한다.

```text
$ grep -n "3영업일" docs/planning/11-spec-draft.md docs/planning/10-proposal-draft.md docs/planning/01-golden-time-sources.md
(출력 없음)

$ grep -nE "620명|25\.9%|19\.7%|35\.2%|31\.3%|161명|1조 2,578억|23,360건|2012\.11|2012년 11월" docs/planning/11-spec-draft.md docs/planning/10-proposal-draft.md
(출력 없음)

$ grep -n "TPL-WRITTEN-FOLLOWUP-001@1\.0" docs/planning/11-spec-draft.md
(출력 없음)
```

출처 판정 이력의 예외도 별도로 확인했다.

```text
$ grep -nE "620명|25\.9%|19\.7%|35\.2%|31\.3%|161명" docs/planning/01-golden-time-sources.md
23:  확보하지 못했다. 제3자 재게시본과 언론 보도는 승인 근거가 아니며, `161명`은 재게시된
```

해당 출력은 바로 앞줄에서 시작하는 하나의 목록 문단 안에
`❌ 원문 미확인 — UI·문서 사용 금지` 판정이 붙은 금지 이력이다.

최종 작업 트리 상태는 다음과 같다.

```text
$ git status --short
 M docs/planning/01-golden-time-sources.md
 M docs/planning/10-proposal-draft.md
 M docs/planning/11-spec-draft.md
?? app/
?? docs/planning/21-revision-plan-r5-applied.md
```

`app/`은 작업 시작 전부터 존재한 다른 작업자의 미추적 변경이다. 이번 작업에서 생성·수정한
파일은 내용 수정 대상 3개와 완료 기준의 적용 보고서 1개뿐이다. `git diff --check`는
출력 없이 종료 코드 `0`으로 통과했다.

## 반영하지 않은 것과 이유

- `app/**`: 다른 작업자가 동시 작업 중이며 이번 문서 개정 범위 밖이므로 수정하지 않았다.
- `docs/planning/12`~`20`, `docs/competition/**`, `docs/research/**`: r5 범위 밖 또는
  역사 기록·수정 금지 영역이므로 수정하지 않았다.
- r5 H1~H6 중 미반영 항목은 없다. 코드 반영과 런타임 검증은 이번 요청 범위 밖이다.
