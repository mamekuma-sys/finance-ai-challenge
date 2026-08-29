import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { DocumentReview } from "@/components/document-review";
import { EmptyState } from "@/components/states";
import { getAsset } from "@/lib/adapters/assets";
import { AppError } from "@/lib/adapters/errors";

export default async function ControlsPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let asset;
  try {
    asset = await getAsset(id);
  } catch (error) {
    if (error instanceof AppError) {
      return <AppShell assetId={id} current="controls" mode={null}><ApiErrorNotice error={error} actionHref={error.kind === "not_found" ? "/" : `/assets/${id}/document`} /></AppShell>;
    }
    throw error;
  }
  const document = (asset.documents ?? []).at(-1);
  const contract = (asset.contracts ?? []).at(-1);

  return (
    <AppShell
      assetId={id}
      assetName={asset.name}
      assetMeta={document ? `문서 v${document.version}` : "문서 미등록"}
      current="controls"
      mode={null}
      isSynthetic
    >
      <div>
        <h1 className="screen-title">발행 문서 검토</h1>
        <p className="screen-lead">
          원문 근거와 6개 통제조건을 확인하고 확정합니다.
        </p>
      </div>
      {document ? <DocumentReview assetId={id} documentId={document.document_id} contractId={contract?.contract_id} /> : <EmptyState title="발행 문서가 없습니다." detail="자산 상세에서 PDF 또는 TXT 문서를 다시 업로드하세요." action={<Link className="btn btn-primary" href={`/assets/${id}`}>업로드로 이동</Link>} />}
    </AppShell>
  );
}
