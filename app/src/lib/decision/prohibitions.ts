export const PROHIBITION_IDS = [
  "PRH-R1-APP",
  "PRH-R1-SEARCH",
  "PRH-R2-DEVICE",
  "PRH-R3-WAIT",
  "PRH-R3-BULK",
  "PRH-R4-WAITAI",
  "PRH-R4-THEIRCH",
  "PRH-R5-CONFIRM",
  "PRH-R6-DONE",
  "PRH-R6-SAFE",
  "PRH-R7-FIXED",
  "PRH-MOD-DEVICE",
  "PRH-MOD-PROXY",
] as const;

export type ProhibitionId = (typeof PROHIBITION_IDS)[number];

export const PROHIBITIONS: Readonly<Record<ProhibitionId, string>> = {
  "PRH-R1-APP": "감염이 의심되는 기기에서 금융 앱을 사용하지 마세요.",
  "PRH-R1-SEARCH":
    "그 기기에서 대표번호를 검색하거나 인증정보를 다시 입력하지 마세요.",
  "PRH-R2-DEVICE":
    "감염이 의심되는 기기의 금융 앱·통화·검색으로 긴급 조치를 하지 마세요.",
  "PRH-R3-WAIT": "재판정 결과를 기다리느라 지급정지 요청을 미루지 마세요.",
  "PRH-R3-BULK":
    "본인계좌 일괄지급정지를 상대 계좌 지급정지의 대체로 여기지 마세요.",
  "PRH-R4-WAITAI": "AI 분석 결과를 기다리느라 조치를 미루지 마세요.",
  "PRH-R4-THEIRCH": "상대가 알려준 번호·링크·앱을 사용하지 마세요.",
  "PRH-R5-CONFIRM":
    "개인정보 노출만으로 상대 계좌 지급정지나 신고 접수가 확정되지는 않습니다.",
  "PRH-R6-DONE": "긴급 처리가 끝난 것으로 여기지 마세요.",
  "PRH-R6-SAFE": "‘낮음’ 판정을 안전 보증으로 여기지 마세요.",
  "PRH-R7-FIXED":
    "‘낮음’ 판정이나 비긴급 경로를 확정된 것으로 여기지 마세요.",
  "PRH-MOD-DEVICE":
    "해당(의심·미확인) 기기의 금융 앱 사용·검색을 하지 마세요.",
  "PRH-MOD-PROXY":
    "가족이 대신 신고·접수할 수 있다고 여기지 마세요 — ECRM 온라인 신고 등 본인 제한 절차는 본인이 직접 수행해야 합니다.",
};
