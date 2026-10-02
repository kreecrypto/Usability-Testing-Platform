import ProjectsClient from "../projects-client";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectsClient view="overview" projectId={projectId} />;
}
