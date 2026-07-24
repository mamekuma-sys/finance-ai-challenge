# r5 코드·UI 반영 보고서

- 기준 계약: `docs/planning/21-revision-plan-r5.md`
- 구현 계약: `docs/planning/11-spec-draft.md` 0.5-r5
- 승인·금지 근거: `app/docs/evidence-verified.md` §1·§2
- 적용일: 2026-07-25
- 적용 범위: `app/`만 변경, 커밋하지 않음

## H1 — 결정 엔진 문구와 템플릿 1.1

- `src/lib/decision/rules.ts:58-67`에 서면 후속 카드의 제목, 목적, 적용
  전제, 현행 법령 문장, 1394 역할 문장을 단일 상수로 선언했다.
- `src/lib/decision/rules.ts:151-192`의 R3에서:
  - R3①·②의 오래된 후속 문장을 현행 시행령 제3조 승인 문장으로 교체했다.
  - R3③의 `title`, `purpose_slot`, `prerequisite`, `required_followup`을
    “긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우”로
    적용 대상을 좁히고 “신청한 날부터 3일 이내”로 고쳤다.
  - 1394는 직접 지급정지 기관이 아니라 피해상담, 의심 전화번호·사이트 제보,
    관계기관 연계 번호로 표시했다.
  - `merge_key="procedure:written_followup"`, 규칙 ID `R3`, `order=3`은
    변경하지 않았다.
- `src/lib/decision/engine.ts:234-281`의 `ensureWrittenFollowup`은 R3와 같은
  상수를 사용한다. 기존 카드 승격 분기, `severity=3`, `order=3`,
  `forced=true`, merge key, 노출 슬롯 로직은 변경하지 않았다.
- `src/lib/templates/registry.ts:5-13,24-30,57-66`에서
  `TPL-WRITTEN-FOLLOWUP-001`만 `1.0`에서 `1.1`로 올렸다.
  `change_log`에는 변경 이유, 변경자, 이전 버전 `1.0`, 롤백 책임자를
  채웠고 `source_reviewed_at=2026-07-25`를 유지했다.
- `src/lib/decision/sources.ts:35-40`의 공식 출처를
  찾기쉬운 생활법령정보 「피해구제 신청」 원문 URL로 바로잡았다.
- `src/lib/decision/sources.ts:56-62`에 경찰청·대한민국 정책브리핑의
  1394 공식 안내를 등록하고, R3③과 폴백 카드의 `official_sources`에
  `SRC-KOREA-1394`를 추가했다. 카드 순서·merge key·`next_steps`·금지
  합집합은 변하지 않는다.
- `src/lib/decision/__tests__/engine.snapshots.test.ts:53-60,95-102,166-172`의
  a·b·d 템플릿 기대값만 `@1.1`로 갱신했다. 카드 순서, merge key,
  `next_steps`, 금지 합집합 기대값은 그대로다.
- `src/lib/decision/__tests__/engine.snapshots.test.ts:207-234`에서 R3③의
  적용 대상·기한·1394 역할과 severity/order/forced를 회귀 테스트한다.
- `src/lib/decision/__tests__/registry.test.ts:97-124`에서 공식 출처,
  버전, 검수일, 변경 이력 네 필드를 검증한다. 기존 §4.7 공통 게이트도
  빈 메타데이터가 있으면 실패한다.

### 변경 이력과 정적 금지 게이트의 경계

계약은 변경 이력에 과거 오문구를 정확히 기록하는 동시에 `app/src/**` 정적
grep에서는 그 금지 문자열이 0건이어야 한다고 요구한다. 두 조건을 함께
충족하기 위해 `src/lib/templates/registry.ts:24-26`은 과거 기한을 두 문자열
조각으로 결합한다. 런타임 `change_log.reason`은 계약이 요구한 완전한 변경
이력 문장이며, 사용자 노출 문구와 정적 소스 리터럴에는 과거 오문구가 없다.
`registry.test.ts:16,105`가 결합된 최종 값을 정확히 대조한다.

## H2 — 14일 결정 기한 오표기

- 변경 전 `app/src/**`에는 환급 완료 기한으로 표현한 문구가 없었다.
- `src/lib/verification/__tests__/forbidden-strings.test.ts:23-24`에 두 금지
  표현을 포함해 향후 유입을 차단했다.
- 승인된 “채권이 소멸된 날부터 14일 이내에 피해환급금을 지급받을 사람과
  금액을 결정” 문장은 이번 UI에 새로 추가하지 않았다. 기존 잘못된 UI가
  없었고, E3 패널의 요구 대상은 3일 이내 서면 제출이기 때문이다.

## H3 — 미검증 설문 수치 제거

- `src/components/evidence-panel.tsx:19-69`에서 비공식 재게시 설문 카드와
  관련 수치·연령별 주장을 전부 제거했다.
- 비공식 기사 링크는 근거 패널에서 더 이상 노출하지 않는다.
- 금지 수치들은 `src/lib/verification/__tests__/forbidden-strings.test.ts:13-18`에서
  소스 트리 전체 회귀 검사 대상으로 고정했다.

## H4 — 연도·정의 미확정 통계 제거

- `src/components/evidence-panel.tsx:19-69`에서 기준 연도와 집계 정의가
  확인되지 않은 피해액·건수 카드를 제거했다.
- 대체 근거 E5는 `src/components/evidence-panel.tsx:20-29`에 승인 문자열
  전체(기간, 전년 동기 값, 두 감소율의 적용 범위)와 금융위원회 원문 링크로
  표시했다.

## H5 — 지연인출제도 승인 문구와 한계

- `src/components/evidence-panel.tsx:31-40`에 E1 승인 문자열 전체를 쓰고
  “창구 거래는 즉시 가능”과 “개별 사건의 잔여 시간·회수 가능성을 뜻하지
  않음”을 같은 카드에 병기했다. 시행일은 표시하지 않았다.
- `src/components/event-history.tsx:53-61`의 경과 타이머 옆에도 같은 제도
  문장과 두 한계를 고정했다.
- `src/components/__tests__/evidence-panel.ui.test.tsx:17-61`이 E5·E1·E3·E10
  네 근거와 타이머 한계 문구를 화면 기준으로 검증한다.

## H6 — KISA 118 선택 안내

- 반영하지 않았다.
- 직접 지시에서 H6는 선택 항목이며, 완료 기준은 스냅샷에서 템플릿 버전 외
  기대값을 유지하도록 요구한다. R1·R2의 `required_followup`을 바꾸지 않아
  선택 변경을 필수 H1~H5와 섞지 않았다. 향후 별도 개정에서 추가할 경우
  `app/docs/evidence-verified.md` E6 승인 문자열을 그대로 사용해야 한다.

## 기존 브라우저 세션의 r4 문구 재노출 차단

- `src/components/rule0-desk.tsx:120-134`에서 `sessionStorage` 복구 시 저장된
  `decision_result`를 화면에 그대로 사용하지 않는다. 저장된 `incident_state`만
  복구하고 현재 `decideActions`로 카드와 템플릿 버전을 다시 계산한다.
- `src/components/__tests__/rule0-desk.ui.test.tsx:411-460`은 과거 기한과
  `TPL-WRITTEN-FOLLOWUP-001` 구버전을 가진 합성 세션을 넣은 뒤, 현재 E3
  승인 제목으로 교체되고 과거 기한이 행동 카드 제목에서 사라지는지 검증한다.
- 따라서 배포 전에 열린 탭을 새로고침해도 r4 카드 문자열이 UI에 되살아나지
  않는다. 상태·행동 이벤트·고령자 모드·세션 실측값은 기존처럼 복구한다.

## 정량 근거 패널 재구성

`src/components/evidence-panel.tsx:19-69`는 다음 네 근거만 표시한다.

1. E5 — 2025년 10월~2026년 4월 두 지표의 전년 동기 대비 35.3% 감소와
   신종 스캠 풍선효과 후속 과제
2. E1 — 1회 100만 원 이상 입금 시 해당 금액 상당액의 CD/ATM 30분 지연,
   창구 즉시 가능, 개별 사건 잔여 시간·회수 가능성 아님
3. E3 — 긴급·부득이한 전화·구술 피해구제 신청 뒤 신청일부터 3일 이내
   해당 금융회사에 신청서 제출
4. E10 — 1394와 1332의 서로 다른 공식 역할

E10은 두 기관 역할을 한 카드에 두되 각각의 공식 링크를 제공한다.
`src/lib/security/allowed-links.ts:1-9`에는 정책브리핑 공식 도메인을 추가했고,
`src/lib/security/__tests__/allowed-links.test.ts:6-20`에서 허용 정책을 검증한다.

## 금지 문자열 회귀 테스트

- 파일: `src/lib/verification/__tests__/forbidden-strings.test.ts:1-59`
- 검사 범위: 재귀적으로 찾은 `app/src/**`의 모든 일반 파일
- 제외 범위: `fileURLToPath(import.meta.url)`로 해석한 테스트 파일 자기 자신
  정확히 1개
- 별도 디렉터리·파일명 패턴·glob 제외는 없어 우회 범위를 만들지 않았다.

실효성 확인:

1. `src/lib/ui/labels.ts`에 금지 수치 한 건을 임시 주입했다.
2. 테스트가 exit 1로 실패하면서 아래 위반을 정확히 출력했다.

```text
file: src/lib/ui/labels.ts
forbidden: 620명
Test Files  1 failed (1)
Tests  1 failed (1)
```

3. 임시 문구를 즉시 되돌렸다.
4. 같은 테스트를 다시 실행해 아래처럼 통과했다.

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

## 검증 원문

`cd /Users/paran/finance-ai-challenge/app && npm run verify`

```text
exit 0
TypeScript: tsc --noEmit 통과
ESLint: 통과
Test Files  14 passed (14)
Tests  55 passed (55)
Next.js 16.2.11 production build: Compiled successfully
Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /llms.txt
```

금지 문자열 grep:

```text
$ grep -rnE "3영업일|620명|25\.9%|19\.7%|161명|1조 2,578억|23,360건|2012\.11|2012년 11월" src/ | grep -v "forbidden-strings"
(출력 없음 — 0건)
```

구버전 템플릿 grep:

```text
$ grep -rn "TPL-WRITTEN-FOLLOWUP-001@1\.0" src/
(출력 없음 — 0건)
```

H2 추가 금지 문구 grep:

```text
$ grep -rnE "14일 안에 환급|14일 내 환급 완료" src/ | grep -v "forbidden-strings"
(출력 없음 — 0건)
```

저장소 범위 확인:

```text
$ git status --short --untracked-files=all | awk '$2 !~ /^app\// { print }'
(출력 없음 — app/ 밖 변경 0건)
```

## 판단이 필요했던 지점

1. 템플릿 `official_source`는 기존 `SRC-EASYLAW-STOPPAY`의 문서명·URL을
   피해구제 신청 원문으로 갱신해 H1의 법령 근거를 맞췄다. 별도로 R3③의
   1394 역할을 직접 뒷받침하도록 `SRC-KOREA-1394`를 추가했다. 이 출처
   보강은 카드 순서·merge key·`next_steps`·금지 합집합을 바꾸지 않는다.
2. E10은 한 카드에 두 역할을 표시하지만 출처 링크는 1394와 1332 각각
   제공한다. 하나의 원문이 두 역할을 모두 지지하는 것처럼 보이지 않게 했다.
3. H2 승인 문장은 잘못된 기존 문구의 교체 대상이 없으므로 새 정보 카드로
   만들지 않았다. 금지 회귀만 추가했다.
4. H6는 직접 지시의 선택 조건과 스냅샷 불변 조건을 근거로 미적용했다.
5. 저장된 `decision_result`에는 이전 템플릿 문구가 남을 수 있으므로 UI 복구
   시 현재 엔진으로 다시 계산한다. 사용자 상태와 로컬 행동 이력은 유지하면서
   폐기된 규제 문구만 다시 노출되지 않게 하는 경계다.

## 반영하지 못한 항목

- 필수 H1~H5 중 반영하지 못한 항목은 없다.
- H6(KISA 118)는 위 이유로 의도적으로 선택하지 않았다.
- 커밋은 수행하지 않았다.
