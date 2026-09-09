import ParticipantRunnerClient from "./participant-runner-client.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ testVersionId: string }> };

export default async function ParticipantRunnerPage({ params }: Props) {
  const { testVersionId } = await params;
  return <ParticipantRunnerClient testVersionId={testVersionId} />;
}
