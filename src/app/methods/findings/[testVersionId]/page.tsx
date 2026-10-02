import MethodFindingsClient from "./findings-client.tsx";

export default async function MethodFindingsPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  return <MethodFindingsClient testVersionId={(await params).testVersionId} />;
}
