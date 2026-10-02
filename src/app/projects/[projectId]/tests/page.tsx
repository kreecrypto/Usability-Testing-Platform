import ProjectsClient from "../../projects-client";

export default async function TestsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectsClient view="tests" projectId={projectId} />;
}
