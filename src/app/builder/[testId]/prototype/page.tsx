import PrototypeImportClient from "./prototype-import-client.tsx";

export default async function PrototypeImportPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  return <PrototypeImportClient testId={testId} />;
}
