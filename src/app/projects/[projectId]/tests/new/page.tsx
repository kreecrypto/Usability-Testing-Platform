import ProjectsClient from "../../../projects-client";

export default async function NewTestPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectsClient view="new-test" projectId={projectId} />;
}
