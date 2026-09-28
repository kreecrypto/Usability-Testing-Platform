import MethodRunnerClient from "./method-runner-client.tsx";

export default async function MethodRunnerPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  return <MethodRunnerClient testVersionId={(await params).testVersionId} />;
}
