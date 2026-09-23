import TaskOutcomeRulesClient from "./task-outcome-rules-client.tsx";

export default async function TaskOutcomeRulesPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  return <TaskOutcomeRulesClient testId={testId} />;
}
