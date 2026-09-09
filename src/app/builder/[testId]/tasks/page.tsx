import TaskScenarioBuilderClient from "./task-scenario-builder-client.tsx";

type Props = { params: Promise<{ testId: string }> };

export default async function TaskEditorPage({ params }: Props) {
  const { testId } = await params;
  return <TaskScenarioBuilderClient testId={testId} />;
}
