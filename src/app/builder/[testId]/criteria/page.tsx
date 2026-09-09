import SuccessCriteriaClient from "./success-criteria-client.tsx";

type Props = { params: Promise<{ testId: string }> };

export default async function SuccessCriteriaPage({ params }: Props) {
  const { testId } = await params;
  return <SuccessCriteriaClient testId={testId} />;
}
