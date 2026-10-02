import MethodResultsClient from "./results-client.tsx";

export default async function MethodResultsPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  return <MethodResultsClient testVersionId={(await params).testVersionId} />;
}
