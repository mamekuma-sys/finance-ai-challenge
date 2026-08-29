import { AppError, type AppErrorKind } from "@/lib/adapters/errors";

const PRESENTATIONS: Record<AppErrorKind, {
  title: string;
  detail: string;
  actionLabel: string;
}> = {
  not_found: {
    title: "요청한 항목을 찾을 수 없습니다.",
    detail: "링크가 오래됐거나 항목이 삭제됐습니다.",
    actionLabel: "홈으로",
  },
  conflict: {
    title: "다른 변경이 먼저 저장됐습니다.",
    detail: "최신 내용을 불러온 뒤 변경사항을 다시 확인해 주세요.",
    actionLabel: "새로고침",
  },
  unauthorized: {
    title: "검토자 잠금 해제가 필요합니다.",
    detail: "변경 작업을 계속하려면 검토자 세션을 잠금 해제하세요.",
    actionLabel: "잠금 해제",
  },
  validation: {
    title: "입력 내용을 저장할 수 없습니다.",
    detail: "표시된 필수값과 원문 근거를 확인해 주세요.",
    actionLabel: "입력 확인",
  },
  server: {
    title: "분석 서버에서 요청을 완료하지 못했습니다.",
    detail: "성공한 P0 결과는 유지됩니다. 잠시 후 다시 시도해 주세요.",
    actionLabel: "다시 시도",
  },
  network: {
    title: "분석 서버에 연결할 수 없습니다.",
    detail: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    actionLabel: "다시 시도",
  },
  integrity: {
    title: "저장된 증거의 무결성을 확인할 수 없습니다.",
    detail: "이 결과를 확정 근거로 사용하지 말고 다시 생성해 주세요.",
    actionLabel: "홈으로",
  },
  unavailable: {
    title: "아직 사용할 수 없는 결과입니다.",
    detail: "처리 상태를 새로 확인해 주세요.",
    actionLabel: "새로고침",
  },
};

export function errorPresentation(kind: AppErrorKind) {
  return PRESENTATIONS[kind];
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof AppError ? errorPresentation(error.kind).detail : fallback;
}
