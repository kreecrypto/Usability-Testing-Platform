import MethodReportClient from "./report-client.tsx";

export default async function MethodReportPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  return <MethodReportClient testVersionId={(await params).testVersionId} />;
}
