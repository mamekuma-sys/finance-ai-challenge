import { ScreenShell } from "@/components/screen-shell";
import { parseScreenState } from "@/lib/screen-state";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { id } = await params;
  const state = parseScreenState((await searchParams).state);

  return (
    <ScreenShell
      title="발행조건 검토"
      screenId="S3"
      url={`/assets/${id}/document`}
      state={state}
    />
  );
}
